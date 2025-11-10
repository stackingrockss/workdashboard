// src/lib/ai/background-transcript-parsing.ts
// Background Gong transcript parsing helper using Inngest for reliable job processing

import { inngest } from "@/lib/inngest/client";

/**
 * Context for background transcript parsing
 */
export interface BackgroundParsingContext {
  gongCallId: string;
  transcriptText: string;
}

/**
 * Triggers Gong transcript parsing using Inngest background jobs
 * This function sends an event to Inngest and returns immediately (non-blocking)
 *
 * @param context - GongCall ID and transcript text
 */
export async function triggerTranscriptParsing(
  context: BackgroundParsingContext
): Promise<void> {
  const { gongCallId, transcriptText } = context;

  // Send event to Inngest - job runs reliably in the background
  await inngest.send({
    name: "gong/transcript.parse",
    data: {
      gongCallId,
      transcriptText,
    },
  });

  console.log(`[Inngest] Queued transcript parsing job for GongCall ${gongCallId}`);
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
  // Trigger Inngest job asynchronously (don't await)
  triggerTranscriptParsing(context).catch((error) => {
    console.error("[Inngest] Failed to queue parsing job:", error);
  });
}
