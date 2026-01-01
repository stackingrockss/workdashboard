import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enrichOpportunityContacts } from "@/lib/integrations/enrichment/service";

/**
 * POST /api/v1/opportunities/[id]/contacts/enrich
 * Bulk enrich all unenriched contacts for an opportunity
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

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

    // Get count of unenriched contacts for preview
    const unenrichedCount = await prisma.contact.count({
      where: {
        opportunityId,
        enrichmentStatus: "none",
        email: { not: null },
      },
    });

    if (unenrichedCount === 0) {
      return NextResponse.json({
        processed: 0,
        enriched: 0,
        skipped: 0,
        failed: 0,
        errors: [],
        message: "No unenriched contacts found",
      });
    }

    // Enrich all contacts
    const result = await enrichOpportunityContacts(
      opportunityId,
      user.organization.id
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to enrich contacts:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to enrich contacts" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/opportunities/[id]/contacts/enrich
 * Get count of unenriched contacts (for UI to show how many can be enriched)
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

    // Count contacts by enrichment status
    const [unenrichedCount, enrichedCount, pendingCount, failedCount, notFoundCount] = await Promise.all([
      prisma.contact.count({
        where: { opportunityId, enrichmentStatus: "none", email: { not: null } },
      }),
      prisma.contact.count({
        where: { opportunityId, enrichmentStatus: "enriched" },
      }),
      prisma.contact.count({
        where: { opportunityId, enrichmentStatus: "pending" },
      }),
      prisma.contact.count({
        where: { opportunityId, enrichmentStatus: "failed" },
      }),
      prisma.contact.count({
        where: { opportunityId, enrichmentStatus: "not_found" },
      }),
    ]);

    return NextResponse.json({
      unenrichedCount,
      enrichedCount,
      pendingCount,
      failedCount,
      notFoundCount,
      canEnrich: unenrichedCount > 0 && !!process.env.HUNTER_API_KEY,
    });
  } catch (error) {
    console.error("Failed to get enrichment status:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to get enrichment status" },
      { status: 500 }
    );
  }
}
