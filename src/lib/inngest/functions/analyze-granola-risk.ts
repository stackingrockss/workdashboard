// src/lib/inngest/functions/analyze-granola-risk.ts
// Inngest background job for analyzing risk in Granola note transcripts

import { inngest } from "@/lib/inngest/client";
import { analyzeCallRisk } from "@/lib/ai/analyze-call-risk"; // SHARED utility - works for any transcript
import { prisma } from "@/lib/db";

/**
 * Background job that analyzes risk signals in a Granola note transcript using AI
 * Triggered after main transcript parsing completes
 */
export const analyzeGranolaRiskJob = inngest.createFunction(
  {
    id: "analyze-granola-risk",
    name: "Analyze Granola Note Risk",
    retries: 3, // Auto-retry up to 3 times on failure
    // Increase timeout for AI analysis of long transcripts
    // Gemini API can take 30-60s for 80K+ character transcripts
    concurrency: {
      limit: 3, // Limit concurrent risk analyses to avoid rate limits
    },
  },
  { event: "granola/risk.analyze" },
  async ({ event, step }) => {
    const { granolaId } = event.data;

    // Step 1: Fetch the note and its transcript
    const note = await step.run("fetch-note", async () => {
      const granolaNote = await prisma.granolaNote.findUnique({
        where: { id: granolaId },
        select: {
          id: true,
          transcriptText: true,
          opportunityId: true,
          meetingDate: true,
        },
      });

      if (!granolaNote) {
        throw new Error(`GranolaNote ${granolaId} not found`);
      }

      if (!granolaNote.transcriptText) {
        throw new Error(`GranolaNote ${granolaId} has no transcript text`);
      }

      return granolaNote;
    });

    // Step 2: Analyze risk using AI (SHARED function - works for any transcript)
    const riskResult = await step.run("analyze-risk", async () => {
      const result = await analyzeCallRisk(note.transcriptText!);
      return result;
    });

    // Step 3: Handle analysis result
    if (!riskResult.success || !riskResult.data) {
      // Log error but don't update parsing status (main parsing already completed)
      await step.run("log-risk-analysis-error", async () => {
        console.error(
          `Risk analysis failed for Granola note ${granolaId}:`,
          riskResult.error
        );
        return { error: riskResult.error };
      });

      throw new Error(`Risk analysis failed: ${riskResult.error}`);
    }

    // Step 4: Save risk assessment results to database
    await step.run("save-risk-assessment", async () => {
      return await prisma.granolaNote.update({
        where: { id: granolaId },
        data: {
          riskAssessment: JSON.parse(JSON.stringify(riskResult.data)),
        },
        select: {
          id: true,
          riskAssessment: true,
        },
      });
    });

    return {
      success: true,
      granolaId,
      riskLevel: riskResult.data.riskLevel,
      riskFactorsCount: riskResult.data.riskFactors.length,
      recommendedActionsCount: riskResult.data.recommendedActions.length,
    };
  }
);
