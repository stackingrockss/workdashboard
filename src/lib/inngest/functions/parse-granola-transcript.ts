// src/lib/inngest/functions/parse-granola-transcript.ts
// Inngest background job for parsing Granola note transcripts

import { inngest } from "@/lib/inngest/client";
import { parseGranolaTranscript } from "@/lib/ai/parse-granola-transcript";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";
import { appendToGranolaHistory } from "@/lib/utils/granola-history";
import { updateOpportunityNextStep } from "@/lib/utils/next-step-updater";
import { broadcastNotificationEvent } from "@/lib/realtime";

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
          whyAndWhyNow: JSON.parse(JSON.stringify(parseResult.data!.whyAndWhyNow)),
          quantifiableMetrics: JSON.parse(JSON.stringify(parseResult.data!.quantifiableMetrics)),
          parsedAt: new Date(),
          parsingStatus: ParsingStatus.completed,
          parsingError: null,
        },
        include: {
          opportunity: true,
        },
      });
    });

    // Step 6: Create notification for opportunity owner if contacts were found
    const notificationResult = await step.run("create-contacts-notification", async () => {
      const peopleCount = parseResult.data!.people.length;
      if (peopleCount === 0) {
        return { notificationCreated: false, reason: "no contacts found" };
      }

      try {
        // Check if notification already exists (upsert pattern)
        const existingNotification = await prisma.contactsReadyNotification.findUnique({
          where: {
            userId_granolaNoteId: {
              userId: updatedNote.opportunity.ownerId,
              granolaNoteId: granolaId,
            },
          },
        });

        if (existingNotification) {
          return { notificationCreated: false, reason: "notification already exists" };
        }

        // Create notification for opportunity owner
        const notification = await prisma.contactsReadyNotification.create({
          data: {
            userId: updatedNote.opportunity.ownerId,
            organizationId: updatedNote.opportunity.organizationId,
            granolaNoteId: granolaId,
            contactCount: peopleCount,
            opportunityId: noteData.opportunityId,
            opportunityName: updatedNote.opportunity.name,
            callTitle: updatedNote.title || "Granola Note",
          },
        });

        // Broadcast real-time notification
        await broadcastNotificationEvent(updatedNote.opportunity.ownerId, {
          type: "contacts:ready",
          payload: {
            notificationId: notification.id,
            granolaNoteId: granolaId,
            contactCount: peopleCount,
            opportunityId: noteData.opportunityId,
            opportunityName: updatedNote.opportunity.name,
            callTitle: updatedNote.title || "Granola Note",
          },
        });

        return { notificationCreated: true, notificationId: notification.id };
      } catch (error) {
        // Log but don't fail the job if notification creation fails
        console.error("Failed to create contacts notification:", error);
        return { notificationCreated: false, error: String(error) };
      }
    });

    // Step 7: Create "Parsing Complete" notification for opportunity owner
    await step.run("create-parsing-complete-notification", async () => {
      try {
        // Check if notification already exists (upsert pattern)
        const existingNotification = await prisma.parsingCompleteNotification.findUnique({
          where: {
            userId_granolaNoteId: {
              userId: updatedNote.opportunity.ownerId,
              granolaNoteId: granolaId,
            },
          },
        });

        if (existingNotification) {
          return { notificationCreated: false, reason: "notification already exists" };
        }

        // Create parsing complete notification
        const notification = await prisma.parsingCompleteNotification.create({
          data: {
            userId: updatedNote.opportunity.ownerId,
            organizationId: updatedNote.opportunity.organizationId,
            granolaNoteId: granolaId,
            opportunityId: noteData.opportunityId,
            opportunityName: updatedNote.opportunity.name,
            callTitle: updatedNote.title || "Granola Note",
          },
        });

        // Broadcast real-time notification
        await broadcastNotificationEvent(updatedNote.opportunity.ownerId, {
          type: "parsing:complete",
          payload: {
            notificationId: notification.id,
            granolaNoteId: granolaId,
            opportunityId: noteData.opportunityId,
            opportunityName: updatedNote.opportunity.name,
            callTitle: updatedNote.title || "Granola Note",
          },
        });

        return { notificationCreated: true, notificationId: notification.id };
      } catch (error) {
        // Log but don't fail the job if notification creation fails
        console.error("Failed to create parsing complete notification:", error);
        return { notificationCreated: false, error: String(error) };
      }
    });

    // Step 8: Update opportunity's nextStep field from latest call
    await step.run("update-opportunity-next-step", async () => {
      const result = await updateOpportunityNextStep(noteData.opportunityId);
      return { updated: result.updated, nextStep: result.nextStep };
    });

    // Step 9: Update opportunity history (with duplicate prevention)
    await step.run("update-opportunity-history", async () => {
      try {
        await appendToGranolaHistory({
          opportunityId: noteData.opportunityId,
          granolaId, // Pass note ID to track and prevent duplicates
          meetingDate: noteData.meetingDate,
          painPoints: parseResult.data!.painPoints,
          goals: parseResult.data!.goals,
          nextSteps: parseResult.data!.nextSteps,
          whyAndWhyNow: parseResult.data!.whyAndWhyNow,
          quantifiableMetrics: parseResult.data!.quantifiableMetrics,
        });
        return { historyUpdated: true };
      } catch (error) {
        // Log but don't fail the job if history update fails
        console.error("Failed to update opportunity history:", error);
        return { historyUpdated: false, error: String(error) };
      }
    });

    // Step 10: Trigger downstream jobs (risk analysis + consolidation check)
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
      whyAndWhyNowCount: parseResult.data.whyAndWhyNow.length,
      quantifiableMetricsCount: parseResult.data.quantifiableMetrics.length,
    };
  }
);
