// src/app/api/v1/opportunities/[id]/consolidate-insights/route.ts
// API endpoint for manually triggering insight consolidation

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { ParsingStatus } from "@prisma/client";

/**
 * POST /api/v1/opportunities/[id]/consolidate-insights
 * Manually trigger consolidation of insights from all parsed Gong calls
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opportunityId } = await params;

  try {
    // Step 1: Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Step 2: Check if at least 2 parsed calls exist
    const parsedCallCount = await prisma.gongCall.count({
      where: {
        opportunityId,
        parsingStatus: ParsingStatus.completed,
        parsedAt: { not: null },
      },
    });

    if (parsedCallCount < 2) {
      return NextResponse.json(
        {
          error: "Consolidation requires at least 2 parsed calls",
          parsedCallCount,
        },
        { status: 400 }
      );
    }

    // Step 3: Set status to processing before triggering job
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { consolidationStatus: "processing" },
    });

    // Step 4: Trigger Inngest consolidation job
    await inngest.send({
      name: "gong/insights.consolidate",
      data: {
        opportunityId,
      },
    });

    return NextResponse.json(
      {
        message: "Consolidation job triggered successfully",
        opportunityId,
        parsedCallCount,
        consolidationStatus: "processing",
      },
      { status: 202 } // 202 Accepted - job is processing in background
    );
  } catch (error) {
    console.error("Failed to trigger consolidation:", error);
    return NextResponse.json(
      { error: "Failed to trigger consolidation" },
      { status: 500 }
    );
  }
}
