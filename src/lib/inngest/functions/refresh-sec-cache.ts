import { inngest } from "../client";
import { forceRefreshSecCache } from "@/lib/integrations/sec-edgar-improved";

/**
 * Inngest function to refresh SEC company cache daily
 * Only refreshes companies with active accounts (targeted approach)
 * Runs at 2 AM UTC to avoid peak hours
 */
export const refreshSecCacheJob = inngest.createFunction(
  {
    id: "refresh-sec-cache",
    name: "Refresh SEC Company Cache (Targeted)",
  },
  { cron: "0 2 * * *" }, // Daily at 2 AM UTC
  async ({ step }) => {
    await step.run("refresh-sec-cache", async () => {
      const startTime = Date.now();
      console.log(`[${new Date().toISOString()}] Starting targeted SEC cache refresh...`);

      try {
        await forceRefreshSecCache();

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[${new Date().toISOString()}] SEC cache refresh completed in ${duration}s`);

        // Get count of cached companies for verification
        const { prisma } = await import("@/lib/db");
        const cachedCount = await prisma.secCompanyCache.count();

        return {
          success: true,
          timestamp: new Date().toISOString(),
          durationSeconds: parseFloat(duration),
          companiesCached: cachedCount,
        };
      } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`[${new Date().toISOString()}] SEC cache refresh failed after ${duration}s:`, error);
        throw error;
      }
    });
  }
);
