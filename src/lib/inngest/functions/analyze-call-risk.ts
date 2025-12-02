// src/lib/inngest/functions/analyze-call-risk.ts
// Inngest background job for analyzing risk in Gong call transcripts

import { inngest } from "@/lib/inngest/client";
import { analyzeCallRisk } from "@/lib/ai/analyze-call-risk";
import { prisma } from "@/lib/db";
import { appendRiskToOpportunityHistory } from "@/lib/utils/risk-assessment-history";

/**
 * Background job that analyzes risk signals in a Gong call transcript using AI
 * Triggered after main transcript parsing completes
 */
export const analyzeCallRiskJob = inngest.createFunction(
  {
    id: "analyze-call-risk",
    name: "Analyze Gong Call Risk",
    retries: 3, // Auto-retry up to 3 times on failure
    // Increase timeout for AI analysis of long transcripts
    // Gemini API can take 30-60s for 80K+ character transcripts
    concurrency: {
      limit: 3, // Limit concurrent risk analyses to avoid rate limits
    },
  },
  { event: "gong/risk.analyze" },
  async ({ event, step }) => {
    const { gongCallId } = event.data;

    // Step 1: Fetch the call and its transcript
    const call = await step.run("fetch-call", async () => {
      const gongCall = await prisma.gongCall.findUnique({
        where: { id: gongCallId },
        select: {
          id: true,
          transcriptText: true,
          opportunityId: true,
          meetingDate: true,
        },
      });

      if (!gongCall) {
        throw new Error(`GongCall ${gongCallId} not found`);
      }

      if (!gongCall.transcriptText) {
        throw new Error(`GongCall ${gongCallId} has no transcript text`);
      }

      return gongCall;
    });

    // Step 2: Analyze risk using AI
    const riskResult = await step.run("analyze-risk", async () => {
      const result = await analyzeCallRisk(call.transcriptText!);
      return result;
    });

    // Step 3: Handle analysis result
    if (!riskResult.success || !riskResult.data) {
      // Log error but don't update parsing status (main parsing already completed)
      await step.run("log-risk-analysis-error", async () => {
        console.error(
          `Risk analysis failed for call ${gongCallId}:`,
          riskResult.error
        );
        // Optionally store error in a dedicated field if we add one later
        return { error: riskResult.error };
      });

      throw new Error(`Risk analysis failed: ${riskResult.error}`);
    }

    // Step 4: Save risk assessment results to database
    await step.run("save-risk-assessment", async () => {
      return await prisma.gongCall.update({
        where: { id: gongCallId },
        data: {
          riskAssessment: JSON.parse(JSON.stringify(riskResult.data)),
        },
        select: {
          id: true,
          riskAssessment: true,
        },
      });
    });

    // Step 5: Update opportunity's risk assessment history
    await step.run("update-risk-history", async () => {
      try {
        await appendRiskToOpportunityHistory({
          opportunityId: call.opportunityId,
          gongCallId,
          meetingDate: call.meetingDate,
          riskAssessment: riskResult.data!,
        });
        return { historyUpdated: true };
      } catch (error) {
        // Log but don't fail the job if history update fails
        console.error("Failed to update risk assessment history:", error);
        return { historyUpdated: false, error: String(error) };
      }
    });

    return {
      success: true,
      gongCallId,
      riskLevel: riskResult.data.riskLevel,
      riskFactorsCount: riskResult.data.riskFactors.length,
      recommendedActionsCount: riskResult.data.recommendedActions.length,
    };
  }
);
