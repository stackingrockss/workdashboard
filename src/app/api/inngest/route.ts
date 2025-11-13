// src/app/api/inngest/route.ts
// Inngest API endpoint for handling background jobs

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { parseGongTranscriptJob } from "@/lib/inngest/functions/parse-gong-transcript";
import { analyzeCallRiskJob } from "@/lib/inngest/functions/analyze-call-risk";
import { consolidateInsightsJob } from "@/lib/inngest/functions/consolidate-insights";
import { syncAllCalendarEventsJob } from "@/lib/inngest/functions/sync-calendar-events";

// Increase timeout for long-running AI jobs
// Vercel Pro: 300s (5 min), Hobby: 60s max
export const maxDuration = 300;

/**
 * Inngest endpoint handler
 * This route handles all Inngest job execution and webhook events
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    parseGongTranscriptJob,
    analyzeCallRiskJob,
    consolidateInsightsJob,
    syncAllCalendarEventsJob, // Phase 3A: Background calendar sync
    // Add more job functions here as needed
  ],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
