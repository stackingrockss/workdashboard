import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getImportableAttendees,
  importContactsFromCalendarEvents,
} from "@/lib/integrations/enrichment/service";

/**
 * GET /api/v1/opportunities/[id]/contacts/import-from-calendar
 * Get a preview of attendees that can be imported from calendar events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

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

    // Get importable attendees preview
    const preview = await getImportableAttendees(
      opportunityId,
      user.organization.id
    );

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Failed to get importable attendees:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get importable attendees" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/opportunities/[id]/contacts/import-from-calendar
 * Import contacts from calendar event attendees
 * Body: { enrich?: boolean } - whether to also enrich after importing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

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

    // Parse request body for options
    let enrich = false;
    try {
      const body = await request.json();
      enrich = body.enrich === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Check if enrichment is requested but not configured
    if (enrich && !process.env.HUNTER_API_KEY) {
      return NextResponse.json(
        { error: "Contact enrichment is not configured. Please set up Hunter.io API key." },
        { status: 503 }
      );
    }

    // Import contacts from calendar events
    const result = await importContactsFromCalendarEvents(
      opportunityId,
      user.organization.id,
      { enrich }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to import contacts from calendar:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to import contacts from calendar" },
      { status: 500 }
    );
  }
}
