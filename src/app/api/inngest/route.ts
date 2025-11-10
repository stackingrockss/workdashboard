// src/app/api/inngest/route.ts
// Inngest API endpoint for handling background jobs

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { parseGongTranscriptJob } from "@/lib/inngest/functions/parse-gong-transcript";

/**
 * Inngest endpoint handler
 * This route handles all Inngest job execution and webhook events
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    parseGongTranscriptJob,
    // Add more job functions here as needed
  ],
});
