import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { contactBatchDuplicateCheckSchema } from "@/lib/validations/contact";
import type { DuplicateCheckResult, DuplicateMatch } from "@/lib/utils/contact-duplicate-detection";

/**
 * Normalizes a name for comparison by:
 * - Converting to lowercase
 * - Removing extra whitespace
 * - Removing common prefixes (Dr., Mr., Ms., etc.)
 * - Removing special characters
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^(dr|mr|ms|mrs|miss|prof|professor)\.?\s+/i, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Calculates Levenshtein distance between two strings.
 * Used for fuzzy name matching.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Checks if two names are similar using Levenshtein distance.
 * Returns true if distance is <= 2 characters different.
 */
function areSimilarNames(name1: string, name2: string): boolean {
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);
  const distance = levenshteinDistance(normalized1, normalized2);
  return distance <= 2;
}

// POST /api/v1/opportunities/[id]/contacts/check-duplicates-batch - Batch check for duplicate contacts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params;
    const body = await request.json();

    // Verify opportunity exists and get accountId
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        accountId: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    if (!opportunity.accountId) {
      return NextResponse.json(
        { error: "Opportunity must be associated with an account to check for duplicates" },
        { status: 400 }
      );
    }

    // Validate input
    const validatedData = contactBatchDuplicateCheckSchema.parse(body);
    const { contacts } = validatedData;

    // Fetch all existing contacts for the account in one query
    const existingContacts = await prisma.contact.findMany({
      where: {
        accountId: opportunity.accountId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        email: true,
      },
    });

    // Build email index for fast lookups
    const emailIndex = new Map<string, typeof existingContacts[0][]>();
    for (const contact of existingContacts) {
      if (contact.email) {
        const normalizedEmail = contact.email.toLowerCase();
        if (!emailIndex.has(normalizedEmail)) {
          emailIndex.set(normalizedEmail, []);
        }
        emailIndex.get(normalizedEmail)!.push(contact);
      }
    }

    // Build name index for fast lookups (normalized first + last name)
    const nameIndex = new Map<string, typeof existingContacts[0][]>();
    for (const contact of existingContacts) {
      const normalizedKey = `${normalizeName(contact.firstName)}_${normalizeName(contact.lastName)}`;
      if (!nameIndex.has(normalizedKey)) {
        nameIndex.set(normalizedKey, []);
      }
      nameIndex.get(normalizedKey)!.push(contact);
    }

    // Check each input contact for duplicates
    const results: DuplicateCheckResult[] = [];

    for (const inputContact of contacts) {
      const matches: DuplicateMatch[] = [];
      const matchedContactIds = new Set<string>();

      // 1. Check for exact email match (highest confidence)
      if (inputContact.email) {
        const normalizedInputEmail = inputContact.email.toLowerCase();
        const emailMatches = emailIndex.get(normalizedInputEmail) || [];

        for (const match of emailMatches) {
          matches.push({
            contactId: match.id,
            firstName: match.firstName,
            lastName: match.lastName,
            title: match.title,
            email: match.email,
            matchType: "exact_email",
            confidence: "high",
          });
          matchedContactIds.add(match.id);
        }
      }

      // 2. Check for exact name match (case-insensitive)
      const normalizedInputKey = `${normalizeName(inputContact.firstName)}_${normalizeName(inputContact.lastName)}`;
      const nameMatches = nameIndex.get(normalizedInputKey) || [];

      for (const match of nameMatches) {
        // Skip if already matched by email
        if (matchedContactIds.has(match.id)) {
          continue;
        }

        matches.push({
          contactId: match.id,
          firstName: match.firstName,
          lastName: match.lastName,
          title: match.title,
          email: match.email,
          matchType: "exact_name",
          confidence: "high",
        });
        matchedContactIds.add(match.id);
      }

      // 3. Check for fuzzy name match (only if no exact matches found)
      if (matches.length === 0) {
        const inputFullName = `${inputContact.firstName} ${inputContact.lastName}`;

        for (const existingContact of existingContacts) {
          const existingFullName = `${existingContact.firstName} ${existingContact.lastName}`;

          if (areSimilarNames(inputFullName, existingFullName)) {
            matches.push({
              contactId: existingContact.id,
              firstName: existingContact.firstName,
              lastName: existingContact.lastName,
              title: existingContact.title,
              email: existingContact.email,
              matchType: "fuzzy_name",
              confidence: "medium",
            });
          }
        }
      }

      results.push({
        isDuplicate: matches.length > 0,
        matches,
      });
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Error batch checking for duplicate contacts:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to check for duplicate contacts" },
      { status: 500 }
    );
  }
}
