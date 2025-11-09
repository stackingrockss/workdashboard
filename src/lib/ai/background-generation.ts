// src/lib/ai/background-generation.ts
// Background AI generation helper for auto-generating account research on opportunity creation

import { generatePreMeetingNotes } from "./meeting-notes";
import { prisma } from "@/lib/db";
import { AccountResearchStatus } from "@prisma/client";

/**
 * Context for background generation
 */
export interface BackgroundGenerationContext {
  opportunityId: string;
  accountName: string;
  companyWebsite?: string;
  stage?: string;
  opportunityValue?: number;
}

/**
 * Triggers account research generation in the background (fire-and-forget)
 * This function is called after opportunity creation and does NOT block the response
 *
 * @param context - Opportunity details needed for AI generation
 */
export async function triggerAccountResearchGeneration(
  context: BackgroundGenerationContext
): Promise<void> {
  const { opportunityId, accountName, companyWebsite, stage, opportunityValue } = context;

  // Fire-and-forget: Don't await, let it run in background
  // Wrap in setImmediate/Promise to ensure it runs asynchronously
  Promise.resolve().then(async () => {
    try {
      console.log(`[Background AI] Starting research generation for opportunity ${opportunityId} (${accountName})`);

      // Update status to 'generating'
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { accountResearchStatus: AccountResearchStatus.generating },
      });

      // Generate AI research using existing function
      const result = await generatePreMeetingNotes({
        accountName,
        companyWebsite,
        stage,
        opportunityValue,
      });

      if (result.success && result.notes) {
        // Truncate to 50,000 chars if needed (Prisma schema limit)
        const truncatedNotes = result.notes.length > 50000
          ? result.notes.substring(0, 50000)
          : result.notes;

        // Update opportunity with generated research
        await prisma.opportunity.update({
          where: { id: opportunityId },
          data: {
            accountResearch: truncatedNotes,
            accountResearchStatus: AccountResearchStatus.completed,
          },
        });

        console.log(`[Background AI] Successfully generated research for opportunity ${opportunityId}`);
      } else {
        // Mark as failed if generation didn't succeed
        await prisma.opportunity.update({
          where: { id: opportunityId },
          data: { accountResearchStatus: AccountResearchStatus.failed },
        });

        console.error(`[Background AI] Failed to generate research for opportunity ${opportunityId}:`, result.error);
      }
    } catch (error) {
      // Silently handle errors - don't throw to avoid disrupting opportunity creation
      console.error(`[Background AI] Error generating research for opportunity ${opportunityId}:`, error);

      // Attempt to mark as failed (best effort)
      try {
        await prisma.opportunity.update({
          where: { id: opportunityId },
          data: { accountResearchStatus: AccountResearchStatus.failed },
        });
      } catch (updateError) {
        console.error(`[Background AI] Failed to update status to 'failed':`, updateError);
      }
    }
  });
}

/**
 * Synchronous wrapper that immediately returns (for fire-and-forget behavior)
 * Use this in API routes to trigger generation without blocking the response
 *
 * @param context - Opportunity details needed for AI generation
 */
export function triggerAccountResearchGenerationAsync(
  context: BackgroundGenerationContext
): void {
  // Don't await - just trigger and return
  triggerAccountResearchGeneration(context).catch((error) => {
    // This should never happen since we catch internally, but just in case
    console.error("[Background AI] Unexpected error in async trigger:", error);
  });
}
