import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  contactBulkImportSchema,
  type ContactBulkImportItem,
} from "@/lib/validations/contact";
import { checkForDuplicateContact } from "@/lib/utils/contact-duplicate-detection";

// POST /api/v1/opportunities/[id]/contacts/bulk - Bulk create contacts
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
        { error: "Opportunity must be associated with an account to create contacts" },
        { status: 400 }
      );
    }

    // Validate input
    const validatedData = contactBulkImportSchema.parse(body);
    const { contacts } = validatedData;

    // Process contacts: check for duplicates and create
    const results = {
      created: [] as Array<{ id: string; firstName: string; lastName: string }>,
      skipped: [] as Array<{ firstName: string; lastName: string; reason: string }>,
      errors: [] as Array<{ firstName: string; lastName: string; error: string }>,
    };

    for (const contactData of contacts) {
      try {
        // Skip duplicate check if requested
        if (!contactData.skipDuplicateCheck) {
          const duplicateCheck = await checkForDuplicateContact(
            contactData.firstName,
            contactData.lastName,
            contactData.email || null,
            opportunity.accountId
          );

          // If duplicate found and no merge requested, skip
          if (duplicateCheck.isDuplicate && !contactData.mergeWithExistingId) {
            const match = duplicateCheck.matches[0];
            results.skipped.push({
              firstName: contactData.firstName,
              lastName: contactData.lastName,
              reason: `Duplicate found: ${match.firstName} ${match.lastName} (${match.matchType})`,
            });
            continue;
          }

          // If merge requested, update existing contact instead of creating new
          if (contactData.mergeWithExistingId) {
            await prisma.contact.update({
              where: { id: contactData.mergeWithExistingId },
              data: {
                title: contactData.title || undefined,
                email: contactData.email || undefined,
                role: contactData.role,
                sentiment: contactData.sentiment,
                notes: contactData.notes || undefined,
                opportunityId: opportunityId, // Link to current opportunity
              },
            });

            results.created.push({
              id: contactData.mergeWithExistingId,
              firstName: contactData.firstName,
              lastName: contactData.lastName,
            });
            continue;
          }
        }

        // Create new contact
        const contact = await prisma.contact.create({
          data: {
            firstName: contactData.firstName,
            lastName: contactData.lastName,
            title: contactData.title || null,
            email: contactData.email || null,
            role: contactData.role,
            sentiment: contactData.sentiment,
            notes: contactData.notes || null,
            opportunityId: opportunityId,
            accountId: opportunity.accountId,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        });

        results.created.push(contact);
      } catch (error) {
        console.error(
          `Error creating contact ${contactData.firstName} ${contactData.lastName}:`,
          error
        );
        results.errors.push({
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    }

    // Return summary of results
    return NextResponse.json(
      {
        success: true,
        summary: {
          total: contacts.length,
          created: results.created.length,
          skipped: results.skipped.length,
          errors: results.errors.length,
        },
        results,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error bulk creating contacts:", error);

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to bulk create contacts" },
      { status: 500 }
    );
  }
}
