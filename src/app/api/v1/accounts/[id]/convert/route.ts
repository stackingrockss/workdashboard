import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const convertToOpportunitySchema = z.object({
  name: z.string().min(1, "Opportunity name is required"),
  amountArr: z.number().int().min(0, "Amount must be non-negative"),
  confidenceLevel: z.number().int().min(1).max(5, "Confidence level must be between 1 and 5"),
  stage: z.enum([
    "discovery",
    "demo",
    "validateSolution",
    "decisionMakerApproval",
    "contracting",
    "closedWon",
    "closedLost",
  ]),
  closeDate: z.string().optional().nullable(),
  quarter: z.string().optional().nullable(),
  forecastCategory: z.enum(["pipeline", "bestCase", "forecast"]).optional().nullable(),
  nextStep: z.string().optional().nullable(),
});

// POST /api/v1/accounts/[id]/convert - Convert account to opportunity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const data = convertToOpportunitySchema.parse(body);

    // Verify account exists
    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        contacts: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Create opportunity from account using a transaction
    const opportunity = await prisma.$transaction(async (tx) => {
      // Create the opportunity
      const newOpportunity = await tx.opportunity.create({
        data: {
          name: data.name,
          amountArr: data.amountArr,
          confidenceLevel: data.confidenceLevel,
          stage: data.stage,
          closeDate: data.closeDate ? new Date(data.closeDate) : null,
          quarter: data.quarter,
          forecastCategory: data.forecastCategory,
          nextStep: data.nextStep,
          accountId: account.id,
          accountName: account.name,
          notes: account.notes, // Copy notes from account to opportunity
          ownerId: user.id,
          organizationId: user.organization.id, // Required field
        },
      });

      // Copy contacts from account to opportunity
      if (account.contacts.length > 0) {
        // Create a map of old contact IDs to new contact IDs
        const contactIdMap = new Map<string, string>();

        // First pass: create all contacts without manager relationships
        for (const contact of account.contacts) {
          const newContact = await tx.contact.create({
            data: {
              firstName: contact.firstName,
              lastName: contact.lastName,
              title: contact.title,
              email: contact.email,
              phone: contact.phone,
              role: contact.role,
              sentiment: contact.sentiment,
              notes: contact.notes,
              positionX: contact.positionX,
              positionY: contact.positionY,
              opportunityId: newOpportunity.id,
              // Don't set managerId yet
            },
          });
          contactIdMap.set(contact.id, newContact.id);
        }

        // Second pass: update manager relationships
        for (const contact of account.contacts) {
          if (contact.managerId) {
            const newContactId = contactIdMap.get(contact.id);
            const newManagerId = contactIdMap.get(contact.managerId);

            if (newContactId && newManagerId) {
              await tx.contact.update({
                where: { id: newContactId },
                data: { managerId: newManagerId },
              });
            }
          }
        }
      }

      return newOpportunity;
    });

    // Fetch the complete opportunity with all relationships
    const completeOpportunity = await prisma.opportunity.findUnique({
      where: { id: opportunity.id },
      include: {
        owner: true,
        account: true,
        contacts: true,
      },
    });

    return NextResponse.json({ opportunity: completeOpportunity }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error converting account to opportunity:", error);
    return NextResponse.json(
      { error: "Failed to convert account to opportunity" },
      { status: 500 }
    );
  }
}
