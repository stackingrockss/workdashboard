// src/lib/inngest/client.ts
// Inngest client configuration for background job processing

import { Inngest } from "inngest";

/**
 * Inngest client instance
 * Used to trigger background jobs from API routes and components
 */
export const inngest = new Inngest({
  id: "opportunity-tracker",
  name: "Opportunity Tracker",
});
