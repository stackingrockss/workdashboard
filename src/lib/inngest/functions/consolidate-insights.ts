// src/lib/inngest/functions/consolidate-insights.ts
// Inngest background job for consolidating insights from multiple Gong calls

import { inngest } from "@/lib/inngest/client";
import { consolidateCallInsights } from "@/lib/ai/consolidate-call-insights";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";
import type { RiskAssessment } from "@/types/gong-call";

/**
 * Background job that consolidates insights from all parsed Gong calls for an opportunity
 * Triggered after a call is successfully parsed (when 2+ calls exist)
 */
export const consolidateInsightsJob = inngest.createFunction(
  {
    id: "consolidate-insights",
    name: "Consolidate Call Insights",
    retries: 3, // Auto-retry up to 3 times on failure
  },
  { event: "gong/insights.consolidate" },
  async ({ event, step }) => {
    const { opportunityId } = event.data;

    // Step 1: Fetch all parsed calls for the opportunity
    const calls = await step.run("fetch-parsed-calls", async () => {
      const parsedCalls = await prisma.gongCall.findMany({
        where: {
          opportunityId,
          parsingStatus: ParsingStatus.completed,
          parsedAt: { not: null },
        },
        select: {
          id: true,
          meetingDate: true,
          painPoints: true,
          goals: true,
          riskAssessment: true,
        },
        orderBy: {
          meetingDate: "asc", // Order by date for temporal analysis
        },
      });

      return parsedCalls;
    });

    // Check if we have at least 2 calls to consolidate
    if (calls.length < 2) {
      return {
        success: false,
        message: `Consolidation requires at least 2 parsed calls. Found: ${calls.length}`,
        opportunityId,
      };
    }

    // Step 2: Transform data for consolidation AI
    const callInsights = calls.map((call) => {
      const meetingDate = call.meetingDate instanceof Date
        ? call.meetingDate.toISOString()
        : String(call.meetingDate);

      return {
        callId: call.id,
        meetingDate,
        painPoints: Array.isArray(call.painPoints)
          ? (call.painPoints as string[])
          : [],
        goals: Array.isArray(call.goals) ? (call.goals as string[]) : [],
        riskAssessment: call.riskAssessment
          ? (call.riskAssessment as RiskAssessment)
          : null,
      };
    });

    // Step 3: Consolidate insights using AI
    const consolidationResult = await step.run(
      "consolidate-with-ai",
      async () => {
        const result = await consolidateCallInsights(callInsights);
        return result;
      }
    );

    // Step 4: Handle consolidation result
    if (!consolidationResult.success || !consolidationResult.data) {
      await step.run("log-consolidation-error", async () => {
        console.error(
          `Consolidation failed for opportunity ${opportunityId}:`,
          consolidationResult.error
        );
        return { error: consolidationResult.error };
      });

      throw new Error(
        `Consolidation failed: ${consolidationResult.error}`
      );
    }

    // Step 5: Save consolidated results to opportunity
    const updatedOpportunity = await step.run(
      "save-consolidated-results",
      async () => {
        return await prisma.opportunity.update({
          where: { id: opportunityId },
          data: {
            consolidatedPainPoints: JSON.parse(
              JSON.stringify(consolidationResult.data!.painPoints)
            ),
            consolidatedGoals: JSON.parse(
              JSON.stringify(consolidationResult.data!.goals)
            ),
            consolidatedRiskAssessment: JSON.parse(
              JSON.stringify(consolidationResult.data!.riskAssessment)
            ),
            lastConsolidatedAt: new Date(),
            consolidationCallCount: calls.length,
          },
          select: {
            id: true,
            consolidatedPainPoints: true,
            consolidatedGoals: true,
            consolidatedRiskAssessment: true,
            lastConsolidatedAt: true,
            consolidationCallCount: true,
          },
        });
      }
    );

    return {
      success: true,
      opportunityId,
      callsConsolidated: calls.length,
      painPointsCount: consolidationResult.data.painPoints.length,
      goalsCount: consolidationResult.data.goals.length,
      riskLevel: consolidationResult.data.riskAssessment.riskLevel,
      lastConsolidatedAt: updatedOpportunity.lastConsolidatedAt,
    };
  }
);
