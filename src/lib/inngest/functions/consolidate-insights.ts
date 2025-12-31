// src/lib/inngest/functions/consolidate-insights.ts
// Inngest background job for consolidating insights from multiple Gong calls AND Granola notes

import { inngest } from "@/lib/inngest/client";
import { consolidateCallInsights } from "@/lib/ai/consolidate-call-insights";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";
import type {
  RiskAssessment,
  CompetitionMention,
  DecisionProcess,
  CallSentiment,
} from "@/types/gong-call";
import {
  deduplicateMeetings,
  logDeduplicationStats,
} from "@/lib/utils/deduplicate-meetings";
import {
  insightsToMarkdown,
  mergeInsightsIntoNotes,
} from "@/lib/utils/insights-to-markdown";

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
              whyAndWhyNow: true,
              quantifiableMetrics: true,
              keyQuotes: true,
              objections: true,
              competitionMentions: true,
              decisionProcess: true,
              callSentiment: true,
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
              whyAndWhyNow: true,
              quantifiableMetrics: true,
              keyQuotes: true,
              objections: true,
              competitionMentions: true,
              decisionProcess: true,
              callSentiment: true,
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
        // Cast to proper types after Inngest serialization
        const result = deduplicateMeetings(
          gongCalls as unknown as Array<{
            id: string;
            source: 'gong';
            meetingDate: Date;
            calendarEventId?: string | null;
            painPoints?: string[] | null;
            goals?: string[] | null;
            riskAssessment?: unknown | null;
            whyAndWhyNow?: string[] | null;
            quantifiableMetrics?: string[] | null;
          }>,
          granolaNotes as unknown as Array<{
            id: string;
            source: 'granola';
            meetingDate: Date;
            calendarEventId?: string | null;
            painPoints?: string[] | null;
            goals?: string[] | null;
            riskAssessment?: unknown | null;
            whyAndWhyNow?: string[] | null;
            quantifiableMetrics?: string[] | null;
          }>
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

      // Type assertion for the meeting with all fields
      const meetingWithAllFields = meeting as typeof meeting & {
        whyAndWhyNow?: unknown;
        quantifiableMetrics?: unknown;
        keyQuotes?: unknown;
        objections?: unknown;
        competitionMentions?: unknown;
        decisionProcess?: unknown;
        callSentiment?: unknown;
      };

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
        whyAndWhyNow: Array.isArray(meetingWithAllFields.whyAndWhyNow)
          ? (meetingWithAllFields.whyAndWhyNow as string[])
          : [],
        quantifiableMetrics: Array.isArray(meetingWithAllFields.quantifiableMetrics)
          ? (meetingWithAllFields.quantifiableMetrics as string[])
          : [],
        keyQuotes: Array.isArray(meetingWithAllFields.keyQuotes)
          ? (meetingWithAllFields.keyQuotes as string[])
          : [],
        objections: Array.isArray(meetingWithAllFields.objections)
          ? (meetingWithAllFields.objections as string[])
          : [],
        competitionMentions: Array.isArray(meetingWithAllFields.competitionMentions)
          ? (meetingWithAllFields.competitionMentions as CompetitionMention[])
          : [],
        decisionProcess: meetingWithAllFields.decisionProcess
          ? (meetingWithAllFields.decisionProcess as DecisionProcess)
          : null,
        callSentiment: meetingWithAllFields.callSentiment
          ? (meetingWithAllFields.callSentiment as CallSentiment)
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
            consolidatedWhyAndWhyNow: JSON.parse(
              JSON.stringify(consolidationResult.data!.whyAndWhyNow)
            ),
            consolidatedMetrics: JSON.parse(
              JSON.stringify(consolidationResult.data!.quantifiableMetrics)
            ),
            // Enhanced consolidated fields
            consolidatedKeyQuotes: JSON.parse(
              JSON.stringify(consolidationResult.data!.keyQuotes)
            ),
            consolidatedObjections: JSON.parse(
              JSON.stringify(consolidationResult.data!.objections)
            ),
            consolidatedCompetition: JSON.parse(
              JSON.stringify(consolidationResult.data!.competitionSummary)
            ),
            consolidatedDecisionProcess: JSON.parse(
              JSON.stringify(consolidationResult.data!.decisionProcessSummary)
            ),
            consolidatedSentimentTrend: JSON.parse(
              JSON.stringify(consolidationResult.data!.sentimentTrend)
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
            consolidatedWhyAndWhyNow: true,
            consolidatedMetrics: true,
            consolidatedKeyQuotes: true,
            consolidatedObjections: true,
            consolidatedCompetition: true,
            consolidatedDecisionProcess: true,
            consolidatedSentimentTrend: true,
            lastConsolidatedAt: true,
            consolidationCallCount: true,
            consolidationStatus: true,
          },
        });
      }
    );

    // Step 7: Auto-merge insights into notes (preserves existing content)
    const autoMergeResult = await step.run(
      "auto-merge-to-notes",
      async () => {
        // Fetch current notes
        const currentOpp = await prisma.opportunity.findUnique({
          where: { id: opportunityId },
          select: { notes: true },
        });

        // Generate insights markdown
        const insightsMarkdown = insightsToMarkdown({
          painPoints: consolidationResult.data!.painPoints,
          goals: consolidationResult.data!.goals,
          riskAssessment: consolidationResult.data!.riskAssessment,
          whyAndWhyNow: consolidationResult.data!.whyAndWhyNow,
          quantifiableMetrics: consolidationResult.data!.quantifiableMetrics,
          lastConsolidatedAt: new Date().toISOString(),
          consolidationCallCount: uniqueMeetings.length,
        });

        // Merge insights into notes (prepends to preserve user content)
        const mergedNotes = mergeInsightsIntoNotes(
          insightsMarkdown,
          currentOpp?.notes
        );

        // Update notes with merged content
        await prisma.opportunity.update({
          where: { id: opportunityId },
          data: { notes: mergedNotes },
        });

        return {
          autoMerged: true,
          hadExistingNotes: Boolean(currentOpp?.notes),
        };
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
      whyAndWhyNowCount: consolidationResult.data.whyAndWhyNow.length,
      quantifiableMetricsCount: consolidationResult.data.quantifiableMetrics.length,
      keyQuotesCount: consolidationResult.data.keyQuotes.length,
      objectionsCount: consolidationResult.data.objections.length,
      competitorsCount: consolidationResult.data.competitionSummary.competitors.length,
      sentimentTrajectory: consolidationResult.data.sentimentTrend.trajectory,
      riskLevel: consolidationResult.data.riskAssessment.riskLevel,
      lastConsolidatedAt: updatedOpportunity.lastConsolidatedAt,
      autoMerged: autoMergeResult.autoMerged,
      hadExistingNotes: autoMergeResult.hadExistingNotes,
    };
  }
);
