// src/lib/inngest/functions/parse-granola-transcript.ts
// Inngest background job for parsing Granola note transcripts

import { inngest } from "@/lib/inngest/client";
import { parseGranolaTranscript } from "@/lib/ai/parse-granola-transcript";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";
import { appendToGranolaHistory } from "@/lib/utils/granola-history";
import { updateOpportunityNextStep } from "@/lib/utils/next-step-updater";

/**
 * Background job that parses a Granola note transcript using AI
 * Triggered when a new note is created or when retrying a failed parse
 */
export const parseGranolaTranscriptJob = inngest.createFunction(
  {
    id: "parse-granola-transcript",
    name: "Parse Granola Note Transcript",
    retries: 3, // Auto-retry up to 3 times on failure
  },
  { event: "granola/transcript.parse" },
  async ({ event, step }) => {
    const { granolaId } = event.data;

    // Step 1: Update status to 'parsing'
    await step.run("update-status-parsing", async () => {
      await prisma.granolaNote.update({
        where: { id: granolaId },
        data: {
          parsingStatus: ParsingStatus.parsing,
          parsingError: null,
        },
      });
      return { status: "parsing" };
    });

    // Step 2: Fetch note data and organization name for filtering
    const noteData = await step.run("fetch-note-data", async () => {
      const note = await prisma.granolaNote.findUnique({
        where: { id: granolaId },
        include: {
          opportunity: {
            include: {
              organization: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!note) {
        throw new Error("Granola note not found");
      }

      if (!note.transcriptText) {
        throw new Error("No transcript text available");
      }

      return {
        transcriptText: note.transcriptText,
        opportunityId: note.opportunityId,
        meetingDate: note.meetingDate,
        organizationName: note.opportunity.organization.name,
      };
    });

    // Step 3: Parse the transcript using AI
    const parseResult = await step.run("parse-transcript", async () => {
      const result = await parseGranolaTranscript(
        noteData.transcriptText,
        noteData.organizationName ?? undefined
      );
      return result;
    });

    // Step 4: Handle parsing result
    if (!parseResult.success || !parseResult.data) {
      // Mark as failed
      await step.run("update-status-failed", async () => {
        await prisma.granolaNote.update({
          where: { id: granolaId },
          data: {
            parsingStatus: ParsingStatus.failed,
            parsingError: parseResult.error || "Unknown parsing error",
          },
        });
      });

      throw new Error(`Parsing failed: ${parseResult.error}`);
    }

    // Step 5: Save parsed results to database
    const updatedNote = await step.run("save-parsed-results", async () => {
      return await prisma.granolaNote.update({
        where: { id: granolaId },
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

    // Step 6: Update opportunity's nextStep field from latest call
    await step.run("update-opportunity-next-step", async () => {
      const result = await updateOpportunityNextStep(noteData.opportunityId);
      return { updated: result.updated, nextStep: result.nextStep };
    });

    // Step 7: Update opportunity history (with duplicate prevention)
    await step.run("update-opportunity-history", async () => {
      try {
        await appendToGranolaHistory({
          opportunityId: noteData.opportunityId,
          granolaId, // Pass note ID to track and prevent duplicates
          meetingDate: noteData.meetingDate,
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

    // Step 8: Trigger downstream jobs (risk analysis + consolidation check)
    // These are sent as separate events so they run independently
    await step.sendEvent("trigger-downstream-jobs", [
      {
        name: "granola/risk.analyze",
        data: { granolaId },
      },
      {
        name: "granola/parsing.completed",
        data: {
          opportunityId: noteData.opportunityId,
          granolaId,
        },
      },
    ]);

    return {
      success: true,
      granolaId,
      painPointsCount: parseResult.data.painPoints.length,
      goalsCount: parseResult.data.goals.length,
      nextStepsCount: parseResult.data.nextSteps.length,
      peopleCount: parseResult.data.people.length,
    };
  }
);
