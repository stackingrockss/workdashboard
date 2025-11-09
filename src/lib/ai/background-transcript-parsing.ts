// src/lib/ai/background-transcript-parsing.ts
// Background Gong transcript parsing helper for non-blocking AI processing

import { parseGongTranscript } from "./parse-gong-transcript";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";

/**
 * Context for background transcript parsing
 */
export interface BackgroundParsingContext {
  gongCallId: string;
  transcriptText: string;
}

/**
 * Triggers Gong transcript parsing in the background (fire-and-forget)
 * This function is called when a user submits a transcript and does NOT block the response
 *
 * @param context - GongCall ID and transcript text
 */
export async function triggerTranscriptParsing(
  context: BackgroundParsingContext
): Promise<void> {
  const { gongCallId, transcriptText } = context;

  // Fire-and-forget: Don't await, let it run in background
  // Wrap in Promise.resolve().then() to ensure it runs asynchronously
  Promise.resolve().then(async () => {
    try {
      console.log(`[Background Parsing] Starting transcript parsing for GongCall ${gongCallId}`);

      // Update status to 'parsing'
      await prisma.gongCall.update({
        where: { id: gongCallId },
        data: {
          parsingStatus: ParsingStatus.parsing,
          parsingError: null, // Clear any previous errors
        },
      });

      // Parse transcript using existing AI function
      const result = await parseGongTranscript(transcriptText);

      if (result.success && result.data) {
        // Update GongCall with parsed results
        await prisma.gongCall.update({
          where: { id: gongCallId },
          data: {
            painPoints: JSON.parse(JSON.stringify(result.data.painPoints)),
            goals: JSON.parse(JSON.stringify(result.data.goals)),
            parsedPeople: JSON.parse(JSON.stringify(result.data.people)),
            nextSteps: JSON.parse(JSON.stringify(result.data.nextSteps)),
            parsedAt: new Date(),
            parsingStatus: ParsingStatus.completed,
            parsingError: null,
          },
        });

        console.log(`[Background Parsing] Successfully parsed transcript for GongCall ${gongCallId}`);
      } else {
        // Mark as failed if parsing didn't succeed
        await prisma.gongCall.update({
          where: { id: gongCallId },
          data: {
            parsingStatus: ParsingStatus.failed,
            parsingError: result.error || "Unknown parsing error",
          },
        });

        console.error(`[Background Parsing] Failed to parse transcript for GongCall ${gongCallId}:`, result.error);
      }
    } catch (error) {
      // Silently handle errors - don't throw to avoid disrupting the API response
      console.error(`[Background Parsing] Error parsing transcript for GongCall ${gongCallId}:`, error);

      // Attempt to mark as failed (best effort)
      try {
        await prisma.gongCall.update({
          where: { id: gongCallId },
          data: {
            parsingStatus: ParsingStatus.failed,
            parsingError: error instanceof Error ? error.message : "Unexpected error during parsing",
          },
        });
      } catch (updateError) {
        console.error(`[Background Parsing] Failed to update status to 'failed':`, updateError);
      }
    }
  });
}

/**
 * Synchronous wrapper that immediately returns (for fire-and-forget behavior)
 * Use this in API routes to trigger parsing without blocking the response
 *
 * @param context - GongCall ID and transcript text
 */
export function triggerTranscriptParsingAsync(
  context: BackgroundParsingContext
): void {
  // Don't await - just trigger and return
  triggerTranscriptParsing(context).catch((error) => {
    // This should never happen since we catch internally, but just in case
    console.error("[Background Parsing] Unexpected error in async trigger:", error);
  });
}
