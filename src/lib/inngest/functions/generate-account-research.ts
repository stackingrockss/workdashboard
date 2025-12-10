// src/lib/inngest/functions/generate-account-research.ts
// Inngest background job for generating AI account research on opportunity creation

import { inngest } from "@/lib/inngest/client";
import { generatePreMeetingNotes } from "@/lib/ai/meeting-notes";
import { prisma } from "@/lib/db";
import { AccountResearchStatus } from "@prisma/client";
import { broadcastNotificationEvent } from "@/lib/realtime";

/**
 * Event data for account research generation
 */
export interface GenerateAccountResearchEventData {
  opportunityId: string;
  accountName: string;
  companyWebsite?: string;
  stage?: string;
  opportunityValue?: number;
}

/**
 * Background job that generates AI-powered account research for an opportunity
 * Triggered when a new opportunity is created with an account name
 *
 * Uses Inngest for reliable background processing with:
 * - Automatic retries on failure
 * - Status tracking (generating -> completed/failed)
 * - Timeout handling for long-running AI calls
 */
export const generateAccountResearchJob = inngest.createFunction(
  {
    id: "generate-account-research",
    name: "Generate Account Research",
    retries: 2, // Retry twice on failure (3 total attempts)
  },
  { event: "opportunity/research.generate" },
  async ({ event, step }) => {
    const { opportunityId, accountName, companyWebsite, stage, opportunityValue } =
      event.data as GenerateAccountResearchEventData;

    // Step 1: Update status to 'generating'
    await step.run("update-status-generating", async () => {
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { accountResearchStatus: AccountResearchStatus.generating },
      });
      return { status: "generating" };
    });

    // Step 2: Generate AI research using existing function
    const result = await step.run("generate-research", async () => {
      const research = await generatePreMeetingNotes({
        accountName,
        companyWebsite,
        stage,
        opportunityValue,
      });
      return research;
    });

    // Step 3: Handle result and update opportunity
    if (result.success && result.fullBrief) {
      const updatedOpportunity = await step.run("save-research-success", async () => {
        return await prisma.opportunity.update({
          where: { id: opportunityId },
          data: {
            accountResearch: result.fullBrief,
            accountResearchGeneratedAt: new Date(),
            accountResearchStatus: AccountResearchStatus.completed,
          },
          select: {
            id: true,
            name: true,
            ownerId: true,
            organizationId: true,
            accountName: true,
          },
        });
      });

      // Step 4: Create notification and broadcast
      await step.run("create-research-notification", async () => {
        try {
          // Check if notification already exists (idempotency)
          const existingNotification = await prisma.accountResearchNotification.findUnique({
            where: { opportunityId: opportunityId },
          });

          if (existingNotification) {
            return { notificationCreated: false, reason: "notification already exists" };
          }

          // Create notification record
          const notification = await prisma.accountResearchNotification.create({
            data: {
              userId: updatedOpportunity.ownerId,
              organizationId: updatedOpportunity.organizationId,
              opportunityId: updatedOpportunity.id,
              opportunityName: updatedOpportunity.name,
              accountName: updatedOpportunity.accountName || accountName,
            },
          });

          // Broadcast real-time notification
          await broadcastNotificationEvent(updatedOpportunity.ownerId, {
            type: "research:complete",
            payload: {
              notificationId: notification.id,
              opportunityId: updatedOpportunity.id,
              opportunityName: updatedOpportunity.name,
              accountName: updatedOpportunity.accountName || accountName,
            },
          });

          return { notificationCreated: true, notificationId: notification.id };
        } catch (error) {
          // Log but don't fail the job if notification creation fails
          console.error("Failed to create account research notification:", error);
          return { notificationCreated: false, error: String(error) };
        }
      });

      return {
        success: true,
        opportunityId,
        accountName,
        researchLength: result.fullBrief.length,
      };
    } else {
      // Mark as failed
      await step.run("save-research-failed", async () => {
        await prisma.opportunity.update({
          where: { id: opportunityId },
          data: { accountResearchStatus: AccountResearchStatus.failed },
        });
      });

      throw new Error(`Research generation failed: ${result.error || "Unknown error"}`);
    }
  }
);

/**
 * Trigger account research generation via Inngest
 * Call this from API routes to queue the background job
 */
export async function triggerAccountResearchGeneration(data: GenerateAccountResearchEventData): Promise<void> {
  await inngest.send({
    name: "opportunity/research.generate",
    data,
  });
}
