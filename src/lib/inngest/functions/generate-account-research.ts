// src/lib/inngest/functions/generate-account-research.ts
// Inngest background job for generating AI account research on opportunity creation

import { inngest } from "@/lib/inngest/client";
import { generatePreMeetingNotes } from "@/lib/ai/meeting-notes";
import { prisma } from "@/lib/db";
import { AccountResearchStatus } from "@prisma/client";

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
      await step.run("save-research-success", async () => {
        await prisma.opportunity.update({
          where: { id: opportunityId },
          data: {
            accountResearch: result.fullBrief,
            accountResearchGeneratedAt: new Date(),
            accountResearchStatus: AccountResearchStatus.completed,
          },
        });
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
