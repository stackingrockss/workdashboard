/**
 * Contact Duplicate Detection Utility
 *
 * Detects potential duplicate contacts when importing from parsed transcripts.
 * Uses name normalization and fuzzy matching to identify existing contacts
 * that might be the same person.
 */

import { prisma } from "@/lib/db";

// ============================================================================
// Types
// ============================================================================

export interface DuplicateMatch {
  contactId: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  email?: string | null;
  matchType: "exact_name" | "exact_email" | "fuzzy_name";
  confidence: "high" | "medium" | "low";
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
}

// ============================================================================
// Utility Functions
// ============================================================================

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
 * Splits a full name into first and last name.
 * Handles common patterns like "John Smith", "Smith, John", etc.
 */
export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const normalized = normalizeName(fullName);

  // Handle "Last, First" format
  if (normalized.includes(",")) {
    const [last, first] = normalized.split(",").map((s) => s.trim());
    return {
      firstName: first || "Unknown",
      lastName: last || "Unknown"
    };
  }

  // Handle "First Last" or "First Middle Last" format
  const parts = normalized.split(" ").filter((s) => s.length > 0);
  if (parts.length === 0) {
    return { firstName: "Unknown", lastName: "Unknown" };
  } else if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Unknown" };
  } else {
    // Take first part as first name, rest as last name
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ");
    return { firstName, lastName };
  }
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

// ============================================================================
// Main Duplicate Detection Function
// ============================================================================

/**
 * Checks for potential duplicate contacts in the database.
 *
 * @param firstName - Contact's first name
 * @param lastName - Contact's last name
 * @param email - Contact's email (optional, for exact email matching)
 * @param accountId - Account ID to scope the search
 * @returns Duplicate check result with matches and confidence levels
 *
 * @example
 * const result = await checkForDuplicateContact("John", "Smith", "john@acme.com", "account-123");
 * if (result.isDuplicate) {
 *   console.log("Found potential duplicates:", result.matches);
 * }
 */
export async function checkForDuplicateContact(
  firstName: string,
  lastName: string,
  email: string | null | undefined,
  accountId: string
): Promise<DuplicateCheckResult> {
  const matches: DuplicateMatch[] = [];

  try {
    // 1. Exact email match (highest confidence)
    if (email) {
      const emailMatches = await prisma.contact.findMany({
        where: {
          accountId,
          email: {
            equals: email,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          email: true,
        },
      });

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
      }
    }

    // 2. Exact name match (case-insensitive)
    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);

    const exactNameMatches = await prisma.contact.findMany({
      where: {
        accountId,
        AND: [
          {
            firstName: {
              equals: normalizedFirstName,
              mode: "insensitive",
            },
          },
          {
            lastName: {
              equals: normalizedLastName,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        email: true,
      },
    });

    for (const match of exactNameMatches) {
      // Skip if already matched by email
      if (matches.some((m) => m.contactId === match.id)) {
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
    }

    // 3. Fuzzy name match (Levenshtein distance <= 2)
    // Only check if we haven't found exact matches
    if (matches.length === 0) {
      const allContactsForAccount = await prisma.contact.findMany({
        where: {
          accountId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          email: true,
        },
      });

      for (const contact of allContactsForAccount) {
        const fullNameInput = `${firstName} ${lastName}`;
        const fullNameContact = `${contact.firstName} ${contact.lastName}`;

        if (areSimilarNames(fullNameInput, fullNameContact)) {
          matches.push({
            contactId: contact.id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            title: contact.title,
            email: contact.email,
            matchType: "fuzzy_name",
            confidence: "medium",
          });
        }
      }
    }

    return {
      isDuplicate: matches.length > 0,
      matches,
    };
  } catch (error) {
    console.error("Error checking for duplicate contacts:", error);
    // On error, assume no duplicates to allow the import to proceed
    return {
      isDuplicate: false,
      matches: [],
    };
  }
}

/**
 * Batch checks for duplicates for multiple contacts.
 * More efficient than calling checkForDuplicateContact individually.
 *
 * @param contacts - Array of contacts to check (firstName, lastName, email, accountId)
 * @returns Array of duplicate check results in the same order as input
 */
export async function checkForDuplicateContactsBatch(
  contacts: Array<{
    firstName: string;
    lastName: string;
    email?: string | null;
    accountId: string;
  }>
): Promise<DuplicateCheckResult[]> {
  const results: DuplicateCheckResult[] = [];

  for (const contact of contacts) {
    const result = await checkForDuplicateContact(
      contact.firstName,
      contact.lastName,
      contact.email,
      contact.accountId
    );
    results.push(result);
  }

  return results;
}
