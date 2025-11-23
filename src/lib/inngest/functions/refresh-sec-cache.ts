import { inngest } from "../client";
import { forceRefreshSecCache } from "@/lib/integrations/sec-edgar-improved";

/**
 * Inngest function to refresh SEC company cache daily
 * Runs at 2 AM UTC to avoid peak hours
 */
export const refreshSecCacheJob = inngest.createFunction(
  {
    id: "refresh-sec-cache",
    name: "Refresh SEC Company Cache",
  },
  { cron: "0 2 * * *" }, // Daily at 2 AM UTC
  async ({ step }) => {
    await step.run("refresh-sec-cache", async () => {
      console.log("Starting scheduled SEC cache refresh...");

      try {
        await forceRefreshSecCache();
        console.log("SEC cache refresh completed successfully");
        return { success: true, timestamp: new Date().toISOString() };
      } catch (error) {
        console.error("SEC cache refresh failed:", error);
        throw error;
      }
    });
  }
);
