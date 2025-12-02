// src/lib/inngest/functions/parse-gong-transcript.ts
// Inngest background job for parsing Gong call transcripts

import { inngest } from "@/lib/inngest/client";
import { parseGongTranscript } from "@/lib/ai/parse-gong-transcript";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";
import { appendToOpportunityHistory } from "@/lib/utils/gong-history";
import { updateOpportunityNextStep } from "@/lib/utils/next-step-updater";
import { broadcastNotificationEvent } from "@/lib/realtime";

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

    // Step 2: Fetch user's organization name for filtering
    const organizationName = await step.run("fetch-organization-name", async () => {
      const gongCall = await prisma.gongCall.findUnique({
        where: { id: gongCallId },
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
      return gongCall?.opportunity?.organization?.name || undefined;
    });

    // Step 3: Parse the transcript using AI
    const parseResult = await step.run("parse-transcript", async () => {
      const result = await parseGongTranscript(transcriptText, organizationName ?? undefined);
      return result;
    });

    // Step 4: Handle parsing result
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

    // Step 5: Save parsed results to database
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
            userId_gongCallId: {
              userId: updatedCall.opportunity.ownerId,
              gongCallId: gongCallId,
            },
          },
        });

        if (existingNotification) {
          return { notificationCreated: false, reason: "notification already exists" };
        }

        // Create notification for opportunity owner
        const notification = await prisma.contactsReadyNotification.create({
          data: {
            userId: updatedCall.opportunity.ownerId,
            organizationId: updatedCall.opportunity.organizationId,
            gongCallId: gongCallId,
            contactCount: peopleCount,
            opportunityId: updatedCall.opportunityId,
            opportunityName: updatedCall.opportunity.name,
            callTitle: updatedCall.title || "Gong Recording",
          },
        });

        // Broadcast real-time notification
        await broadcastNotificationEvent(updatedCall.opportunity.ownerId, {
          type: "contacts:ready",
          payload: {
            notificationId: notification.id,
            gongCallId: gongCallId,
            contactCount: peopleCount,
            opportunityId: updatedCall.opportunityId,
            opportunityName: updatedCall.opportunity.name,
            callTitle: updatedCall.title || "Gong Recording",
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
            userId_gongCallId: {
              userId: updatedCall.opportunity.ownerId,
              gongCallId: gongCallId,
            },
          },
        });

        if (existingNotification) {
          return { notificationCreated: false, reason: "notification already exists" };
        }

        // Create parsing complete notification
        const notification = await prisma.parsingCompleteNotification.create({
          data: {
            userId: updatedCall.opportunity.ownerId,
            organizationId: updatedCall.opportunity.organizationId,
            gongCallId: gongCallId,
            opportunityId: updatedCall.opportunityId,
            opportunityName: updatedCall.opportunity.name,
            callTitle: updatedCall.title || "Gong Recording",
          },
        });

        // Broadcast real-time notification
        await broadcastNotificationEvent(updatedCall.opportunity.ownerId, {
          type: "parsing:complete",
          payload: {
            notificationId: notification.id,
            gongCallId: gongCallId,
            opportunityId: updatedCall.opportunityId,
            opportunityName: updatedCall.opportunity.name,
            callTitle: updatedCall.title || "Gong Recording",
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
      const result = await updateOpportunityNextStep(updatedCall.opportunityId);
      return { updated: result.updated, nextStep: result.nextStep };
    });

    // Step 9: Update opportunity history (with duplicate prevention)
    await step.run("update-opportunity-history", async () => {
      try {
        await appendToOpportunityHistory({
          opportunityId: updatedCall.opportunityId,
          gongCallId, // Pass call ID to track and prevent duplicates
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

    // Step 10: Trigger downstream jobs (risk analysis + consolidation check)
    // These are sent as separate events so they run independently and aren't
    // affected by timeouts in this job
    // NOTE: step.sendEvent must be called directly, not nested inside step.run
    await step.sendEvent("trigger-downstream-jobs", [
      {
        name: "gong/risk.analyze",
        data: { gongCallId },
      },
      {
        name: "gong/parsing.completed",
        data: {
          opportunityId: updatedCall.opportunityId,
          gongCallId,
        },
      },
    ]);

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
