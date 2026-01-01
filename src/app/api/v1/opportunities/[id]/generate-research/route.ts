// src/app/api/v1/opportunities/[id]/generate-research/route.ts
// API endpoint to trigger account research generation using the brief system

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { triggerAccountResearchGeneration } from "@/lib/inngest/functions/generate-account-research";

const generateResearchSchema = z.object({
  briefId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { briefId } = generateResearchSchema.parse(body);

    // Fetch opportunity with security check
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
      },
      include: {
        account: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const accountName = opportunity.account?.name || opportunity.accountName;
    if (!accountName) {
      return NextResponse.json(
        { error: "Account name is required to generate research" },
        { status: 400 }
      );
    }

    // Trigger the Inngest job
    await triggerAccountResearchGeneration({
      opportunityId: opportunity.id,
      accountName,
      companyWebsite: opportunity.account?.website || undefined,
      stage: opportunity.stage || undefined,
      opportunityValue: opportunity.amountArr > 0 ? opportunity.amountArr : undefined,
      briefId: briefId || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Account research generation started",
      status: "generating",
    });
  } catch (error) {
    console.error("Error triggering account research generation:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to start research generation" },
      { status: 500 }
    );
  }
}
