// src/app/api/v1/opportunities/[id]/research-status/route.ts
// Lightweight polling endpoint for checking account research generation status

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/v1/opportunities/[id]/research-status
 * Returns the current status of account research generation and the research content if available
 *
 * Response:
 * {
 *   status: "generating" | "completed" | "failed" | null,
 *   accountResearch: string | null
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

    // Fetch only the fields we need for polling (lightweight query)
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        accountResearchStatus: true,
        accountResearch: true,
        organizationId: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Verify user has access to this opportunity (same organization)
    if (opportunity.organizationId !== user.organization.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({
      status: opportunity.accountResearchStatus,
      accountResearch: opportunity.accountResearch,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching research status:", error);
    return NextResponse.json(
      { error: "Failed to fetch research status" },
      { status: 500 }
    );
  }
}
