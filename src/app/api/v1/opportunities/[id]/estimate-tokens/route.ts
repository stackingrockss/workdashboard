/**
 * GET /api/v1/opportunities/[id]/estimate-tokens
 *
 * Estimates token usage for document generation based on selected context.
 * Returns detailed breakdown of tokens per source.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
  estimateBriefTokens,
  estimateOpportunityTokens,
  estimateAccountTokens,
  estimateContactsTokens,
  estimateConsolidatedInsightsTokens,
  estimateMeetingTokens,
  estimateAccountResearchTokens,
  estimateAdditionalContextTokens,
  formatTokenCount,
  GEMINI_MODEL_LIMITS,
  DEFAULT_MODEL,
  type MeetingTokenEstimate,
} from "@/lib/ai/token-estimator";

// Query schema for GET request
const querySchema = z.object({
  briefId: z.string().optional(),
  gongCallIds: z.string().optional(), // Comma-separated
  granolaNoteIds: z.string().optional(), // Comma-separated
  googleNoteIds: z.string().optional(), // Comma-separated
  includeConsolidatedInsights: z.enum(["true", "false"]).optional(),
  includeAccountResearch: z.enum(["true", "false"]).optional(),
  additionalContextLength: z.string().optional(), // Character count
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params;

    // Get authenticated user and organization
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      select: { organizationId: true },
    });

    if (!dbUser?.organizationId) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 403 }
      );
    }

    const organizationId = dbUser.organizationId;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const parsed = querySchema.parse({
      briefId: searchParams.get("briefId") || undefined,
      gongCallIds: searchParams.get("gongCallIds") || undefined,
      granolaNoteIds: searchParams.get("granolaNoteIds") || undefined,
      googleNoteIds: searchParams.get("googleNoteIds") || undefined,
      includeConsolidatedInsights:
        searchParams.get("includeConsolidatedInsights") || undefined,
      includeAccountResearch:
        searchParams.get("includeAccountResearch") || undefined,
      additionalContextLength:
        searchParams.get("additionalContextLength") || undefined,
    });

    // Parse IDs
    const gongCallIds = parsed.gongCallIds
      ? parsed.gongCallIds.split(",").filter(Boolean)
      : [];
    const granolaNoteIds = parsed.granolaNoteIds
      ? parsed.granolaNoteIds.split(",").filter(Boolean)
      : [];
    const googleNoteIds = parsed.googleNoteIds
      ? parsed.googleNoteIds.split(",").filter(Boolean)
      : [];
    const includeConsolidatedInsights =
      parsed.includeConsolidatedInsights === "true";
    const includeAccountResearch = parsed.includeAccountResearch === "true";
    const additionalContextLength = parseInt(
      parsed.additionalContextLength || "0",
      10
    );

    // Fetch opportunity with related data
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId,
      },
      include: {
        account: true,
        contacts: true,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Fetch brief if specified
    let briefTokens = {
      systemInstruction: 0,
      outputFormat: 0,
      sections: 0,
      total: 0,
    };

    if (parsed.briefId) {
      const brief = await prisma.contentBrief.findFirst({
        where: {
          id: parsed.briefId,
          organizationId,
        },
        select: {
          systemInstruction: true,
          outputFormat: true,
          sections: true,
        },
      });

      if (brief) {
        briefTokens = estimateBriefTokens({
          systemInstruction: brief.systemInstruction,
          outputFormat: brief.outputFormat,
          sections: brief.sections as Array<{
            title: string;
            description?: string;
          }>,
        });
      }
    }

    // Estimate opportunity tokens
    const opportunityTokens = estimateOpportunityTokens({
      name: opportunity.name,
      amountArr: opportunity.amountArr,
      stage: opportunity.stage,
      confidenceLevel: opportunity.confidenceLevel,
      closeDate: opportunity.closeDate,
      competition: opportunity.competition,
      platformType: opportunity.platformType,
      nextStep: opportunity.nextStep,
      notes: opportunity.notes,
    });

    // Estimate account tokens
    const accountTokens = opportunity.account
      ? estimateAccountTokens({
          name: opportunity.account.name,
          industry: opportunity.account.industry,
          website: opportunity.account.website,
          ticker: opportunity.account.ticker,
        })
      : 0;

    // Estimate contacts tokens
    const contactsTokens = estimateContactsTokens(
      opportunity.contacts.map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        title: c.title,
        role: c.role,
        sentiment: c.sentiment,
      }))
    );

    // Estimate consolidated insights tokens
    let consolidatedInsightsTokens = 0;
    if (includeConsolidatedInsights) {
      consolidatedInsightsTokens = estimateConsolidatedInsightsTokens({
        painPoints: opportunity.consolidatedPainPoints as string[] | null,
        goals: opportunity.consolidatedGoals as string[] | null,
        whyAndWhyNow: opportunity.consolidatedWhyAndWhyNow as string[] | null,
        quantifiableMetrics: opportunity.consolidatedMetrics as string[] | null,
        riskAssessment: opportunity.consolidatedRiskAssessment,
      });
    }

    // Estimate account research tokens
    let accountResearchTokens = 0;
    if (includeAccountResearch && opportunity.accountResearch) {
      accountResearchTokens = estimateAccountResearchTokens(
        opportunity.accountResearch
      );
    }

    // Estimate meetings tokens
    const meetingEstimates: MeetingTokenEstimate[] = [];

    // Fetch Gong calls with transcript info
    if (gongCallIds.length > 0) {
      const gongCalls = await prisma.gongCall.findMany({
        where: {
          id: { in: gongCallIds },
          opportunityId,
        },
        select: {
          id: true,
          title: true,
          meetingDate: true,
          transcriptText: true,
          painPoints: true,
          goals: true,
          nextSteps: true,
          whyAndWhyNow: true,
          quantifiableMetrics: true,
        },
      });

      for (const call of gongCalls) {
        const estimate = estimateMeetingTokens({
          title: call.title,
          date: call.meetingDate,
          type: "gong",
          transcriptText: call.transcriptText,
          painPoints: call.painPoints as unknown[] | null,
          goals: call.goals as unknown[] | null,
          nextSteps: call.nextSteps as unknown[] | null,
          whyAndWhyNow: call.whyAndWhyNow as unknown[] | null,
          quantifiableMetrics: call.quantifiableMetrics as unknown[] | null,
        });
        meetingEstimates.push({ ...estimate, id: call.id });
      }
    }

    // Fetch Granola notes with transcript info
    if (granolaNoteIds.length > 0) {
      const granolaNotes = await prisma.granolaNote.findMany({
        where: {
          id: { in: granolaNoteIds },
          opportunityId,
        },
        select: {
          id: true,
          title: true,
          meetingDate: true,
          transcriptText: true,
          painPoints: true,
          goals: true,
          nextSteps: true,
          whyAndWhyNow: true,
          quantifiableMetrics: true,
        },
      });

      for (const note of granolaNotes) {
        const estimate = estimateMeetingTokens({
          title: note.title,
          date: note.meetingDate,
          type: "granola",
          transcriptText: note.transcriptText,
          painPoints: note.painPoints as unknown[] | null,
          goals: note.goals as unknown[] | null,
          nextSteps: note.nextSteps as unknown[] | null,
          whyAndWhyNow: note.whyAndWhyNow as unknown[] | null,
          quantifiableMetrics: note.quantifiableMetrics as unknown[] | null,
        });
        meetingEstimates.push({ ...estimate, id: note.id });
      }
    }

    // Fetch Google notes (no transcript)
    if (googleNoteIds.length > 0) {
      const googleNotes = await prisma.googleNote.findMany({
        where: {
          id: { in: googleNoteIds },
          opportunityId,
        },
        select: {
          id: true,
          title: true,
        },
      });

      for (const note of googleNotes) {
        meetingEstimates.push({
          id: note.id,
          title: note.title,
          type: "google",
          estimatedTokens: 50, // Minimal tokens for Google notes (just URL reference)
          hasTranscript: false,
          insightsCount: 0,
        });
      }
    }

    const meetingsTotal = meetingEstimates.reduce(
      (acc, m) => acc + m.estimatedTokens,
      0
    );

    // Estimate additional context
    const additionalContextTokens = estimateAdditionalContextTokens(
      additionalContextLength > 0 ? "x".repeat(additionalContextLength) : null
    );

    // Calculate totals
    const contextTotal =
      opportunityTokens +
      accountTokens +
      contactsTokens +
      consolidatedInsightsTokens +
      meetingsTotal +
      accountResearchTokens +
      additionalContextTokens;

    const totalEstimated = briefTokens.total + contextTotal;

    // Get model limits
    const modelLimits = GEMINI_MODEL_LIMITS[DEFAULT_MODEL];
    const percentageOfLimit = (totalEstimated / modelLimits.inputLimit) * 100;

    return NextResponse.json({
      estimate: {
        brief: briefTokens,
        context: {
          opportunity: opportunityTokens,
          account: accountTokens,
          contacts: contactsTokens,
          consolidatedInsights: consolidatedInsightsTokens,
          meetings: meetingsTotal,
          accountResearch: accountResearchTokens,
          additionalContext: additionalContextTokens,
          total: contextTotal,
        },
        meetings: meetingEstimates,
        totalEstimated,
        totalFormatted: formatTokenCount(totalEstimated),
        modelLimits: {
          model: modelLimits.model,
          inputLimit: modelLimits.inputLimit,
          inputLimitFormatted: formatTokenCount(modelLimits.inputLimit),
          outputLimit: modelLimits.outputLimit,
        },
        percentageOfLimit: Math.round(percentageOfLimit * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error estimating tokens:", error);
    return NextResponse.json(
      { error: "Failed to estimate tokens" },
      { status: 500 }
    );
  }
}
