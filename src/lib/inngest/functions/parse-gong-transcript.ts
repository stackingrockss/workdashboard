// src/lib/inngest/functions/parse-gong-transcript.ts
// Inngest background job for parsing Gong call transcripts

import { inngest } from "@/lib/inngest/client";
import { parseGongTranscript } from "@/lib/ai/parse-gong-transcript";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";
import { appendToOpportunityHistory } from "@/lib/utils/gong-history";

/**
 * Background job that parses a Gong call transcript using AI
 * Triggered when a new call is created or when retrying a failed parse
 */
export const parseGongTranscriptJob = inngest.createFunction(
  {
    id: "parse-gong-transcript",
    name: "Parse Gong Call Transcript",
    retries: 3, // Auto-retry up to 3 times on failure
  },
  { event: "gong/transcript.parse" },
  async ({ event, step }) => {
    const { gongCallId, transcriptText } = event.data;

    // Step 1: Update status to 'parsing'
    await step.run("update-status-parsing", async () => {
      await prisma.gongCall.update({
        where: { id: gongCallId },
        data: {
          parsingStatus: ParsingStatus.parsing,
          parsingError: null,
        },
      });
      return { status: "parsing" };
    });

    // Step 2: Parse the transcript using AI
    const parseResult = await step.run("parse-transcript", async () => {
      const result = await parseGongTranscript(transcriptText);
      return result;
    });

    // Step 3: Handle parsing result
    if (!parseResult.success || !parseResult.data) {
      // Mark as failed
      await step.run("update-status-failed", async () => {
        await prisma.gongCall.update({
          where: { id: gongCallId },
          data: {
            parsingStatus: ParsingStatus.failed,
            parsingError: parseResult.error || "Unknown parsing error",
          },
        });
      });

      throw new Error(`Parsing failed: ${parseResult.error}`);
    }

    // Step 4: Save parsed results to database
    const updatedCall = await step.run("save-parsed-results", async () => {
      return await prisma.gongCall.update({
        where: { id: gongCallId },
        data: {
          painPoints: JSON.parse(JSON.stringify(parseResult.data!.painPoints)),
          goals: JSON.parse(JSON.stringify(parseResult.data!.goals)),
          parsedPeople: JSON.parse(JSON.stringify(parseResult.data!.people)),
          nextSteps: JSON.parse(JSON.stringify(parseResult.data!.nextSteps)),
          parsedAt: new Date(),
          parsingStatus: ParsingStatus.completed,
          parsingError: null,
        },
        include: {
          opportunity: true,
        },
      });
    });

    // Step 5: Update opportunity history
    await step.run("update-opportunity-history", async () => {
      try {
        await appendToOpportunityHistory({
          opportunityId: updatedCall.opportunityId,
          meetingDate: updatedCall.meetingDate,
          painPoints: parseResult.data!.painPoints,
          goals: parseResult.data!.goals,
          nextSteps: parseResult.data!.nextSteps,
        });
        return { historyUpdated: true };
      } catch (error) {
        // Log but don't fail the job if history update fails
        console.error("Failed to update opportunity history:", error);
        return { historyUpdated: false, error: String(error) };
      }
    });

    return {
      success: true,
      gongCallId,
      painPointsCount: parseResult.data.painPoints.length,
      goalsCount: parseResult.data.goals.length,
      nextStepsCount: parseResult.data.nextSteps.length,
      peopleCount: parseResult.data.people.length,
    };
  }
);
