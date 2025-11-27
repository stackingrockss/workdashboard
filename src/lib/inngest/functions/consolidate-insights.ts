// src/lib/inngest/functions/consolidate-insights.ts
// Inngest background job for consolidating insights from multiple Gong calls AND Granola notes

import { inngest } from "@/lib/inngest/client";
import { consolidateCallInsights } from "@/lib/ai/consolidate-call-insights";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";
import type { RiskAssessment } from "@/types/gong-call";
import {
  deduplicateMeetings,
  logDeduplicationStats,
} from "@/lib/utils/deduplicate-meetings";

/**
 * Background job that consolidates insights from all parsed Gong calls AND Granola notes
 * Triggered after a call/note is successfully parsed (when 2+ meetings exist)
 *
 * Smart deduplication:
 * - Matches meetings by calendar event ID (exact) or date/time (1-hour window)
 * - When duplicates found, always prioritizes Gong over Granola
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

    // Step 0: Set status to processing
    await step.run("set-processing-status", async () => {
      return await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { consolidationStatus: "processing" },
      });
    });

    // Step 1: Fetch all parsed Gong calls AND Granola notes for the opportunity
    const { gongCalls, granolaNotes } = await step.run(
      "fetch-parsed-meetings",
      async () => {
        const [parsedGongCalls, parsedGranolaNotes] = await Promise.all([
          // Fetch Gong calls
          prisma.gongCall.findMany({
            where: {
              opportunityId,
              parsingStatus: ParsingStatus.completed,
              parsedAt: { not: null },
            },
            select: {
              id: true,
              meetingDate: true,
              calendarEventId: true,
              painPoints: true,
              goals: true,
              riskAssessment: true,
            },
          }),
          // Fetch Granola notes
          prisma.granolaNote.findMany({
            where: {
              opportunityId,
              parsingStatus: ParsingStatus.completed,
              parsedAt: { not: null },
            },
            select: {
              id: true,
              meetingDate: true,
              calendarEventId: true,
              painPoints: true,
              goals: true,
              riskAssessment: true,
            },
          }),
        ]);

        return {
          gongCalls: parsedGongCalls.map((call) => ({ ...call, source: 'gong' as const })),
          granolaNotes: parsedGranolaNotes.map((note) => ({ ...note, source: 'granola' as const })),
        };
      }
    );

    // Step 2: Deduplicate meetings (Gong priority)
    const deduplicationResult = await step.run(
      "deduplicate-meetings",
      async () => {
        const result = deduplicateMeetings(
          gongCalls as Parameters<typeof deduplicateMeetings>[0],
          granolaNotes as Parameters<typeof deduplicateMeetings>[1]
        );

        // Log deduplication stats for debugging
        logDeduplicationStats(opportunityId, result);

        return result;
      }
    );

    const uniqueMeetings = deduplicationResult.uniqueMeetings;

    // Check if we have at least 2 unique meetings to consolidate
    if (uniqueMeetings.length < 2) {
      await step.run("set-idle-status", async () => {
        return await prisma.opportunity.update({
          where: { id: opportunityId },
          data: { consolidationStatus: "idle" },
        });
      });

      return {
        success: false,
        message: `Consolidation requires at least 2 unique meetings. Found: ${uniqueMeetings.length} (${gongCalls.length} Gong, ${granolaNotes.length} Granola, ${deduplicationResult.duplicatesRemoved} duplicates removed)`,
        opportunityId,
      };
    }

    // Step 3: Transform deduplicated meetings for consolidation AI
    const callInsights = uniqueMeetings.map((meeting) => {
      // Convert meetingDate to ISO string
      const meetingDate = new Date(meeting.meetingDate).toISOString();

      return {
        callId: meeting.id,
        meetingDate,
        painPoints: Array.isArray(meeting.painPoints)
          ? (meeting.painPoints as string[])
          : [],
        goals: Array.isArray(meeting.goals)
          ? (meeting.goals as string[])
          : [],
        riskAssessment: meeting.riskAssessment
          ? (meeting.riskAssessment as unknown as RiskAssessment)
          : null,
      };
    });

    // Step 4: Consolidate insights using AI
    const consolidationResult = await step.run(
      "consolidate-with-ai",
      async () => {
        const result = await consolidateCallInsights(callInsights);
        return result;
      }
    );

    // Step 5: Handle consolidation result
    if (!consolidationResult.success || !consolidationResult.data) {
      await step.run("set-failed-status", async () => {
        return await prisma.opportunity.update({
          where: { id: opportunityId },
          data: { consolidationStatus: "failed" },
        });
      });

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

    // Step 6: Save consolidated results to opportunity
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
            consolidationCallCount: uniqueMeetings.length, // Count unique meetings (after deduplication)
            consolidationStatus: "completed",
          },
          select: {
            id: true,
            consolidatedPainPoints: true,
            consolidatedGoals: true,
            consolidatedRiskAssessment: true,
            lastConsolidatedAt: true,
            consolidationCallCount: true,
            consolidationStatus: true,
          },
        });
      }
    );

    return {
      success: true,
      opportunityId,
      totalMeetings: gongCalls.length + granolaNotes.length,
      uniqueMeetings: uniqueMeetings.length,
      duplicatesRemoved: deduplicationResult.duplicatesRemoved,
      gongPrioritized: deduplicationResult.gongPrioritized,
      callsConsolidated: uniqueMeetings.length,
      painPointsCount: consolidationResult.data.painPoints.length,
      goalsCount: consolidationResult.data.goals.length,
      riskLevel: consolidationResult.data.riskAssessment.riskLevel,
      lastConsolidatedAt: updatedOpportunity.lastConsolidatedAt,
    };
  }
);
