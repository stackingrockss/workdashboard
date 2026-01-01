import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enrichSingleContact } from "@/lib/integrations/enrichment/service";

/**
 * POST /api/v1/opportunities/[id]/contacts/[contactId]/enrich
 * Manually trigger enrichment for a single contact
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, contactId } = await params;

    // Check if Hunter API is configured
    if (!process.env.HUNTER_API_KEY) {
      return NextResponse.json(
        { error: "Contact enrichment is not configured. Please set up Hunter.io API key." },
        { status: 503 }
      );
    }

    // Verify opportunity exists and belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Verify contact exists and belongs to this opportunity
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        opportunityId,
      },
      select: {
        id: true,
        email: true,
        enrichmentStatus: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    if (!contact.email) {
      return NextResponse.json(
        { error: "Contact has no email address" },
        { status: 400 }
      );
    }

    // Parse request body for options
    let forceRefresh = false;
    try {
      const body = await request.json();
      forceRefresh = body.forceRefresh === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Enrich the contact
    const result = await enrichSingleContact(contactId, user.organization.id, {
      forceRefresh,
    });

    if (result.success) {
      return NextResponse.json({
        contact: result.contact,
        enriched: true,
      });
    } else {
      // Return the contact state even on failure (e.g., "not_found" status)
      return NextResponse.json({
        contact: result.contact,
        enriched: false,
        error: result.error,
      }, { status: result.error === "Contact already enriched" ? 200 : 400 });
    }
  } catch (error) {
    console.error("Failed to enrich contact:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to enrich contact" },
      { status: 500 }
    );
  }
}
