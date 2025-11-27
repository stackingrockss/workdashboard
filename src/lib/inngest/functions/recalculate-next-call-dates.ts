// src/lib/inngest/functions/recalculate-next-call-dates.ts
// Inngest background job for recalculating next call dates from meetings

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { recalculateNextCallDateForOpportunity } from "@/lib/utils/next-call-date-calculator";

/**
 * Background job that recalculates next call dates for opportunities with stale data
 * Ensures consistency by recalculating dates that are >24 hours old or never calculated
 * Runs daily at 2 AM (off-peak hours)
 */
export const recalculateNextCallDatesJob = inngest.createFunction(
  {
    id: "recalculate-next-call-dates",
    name: "Recalculate Next Call Dates",
    retries: 1,
  },
  { cron: "0 2 * * *" }, // Daily at 2 AM
  async ({ step }) => {
    // Step 1: Find opportunities with stale next call date calculations
    const staleOpportunities = await step.run("find-stale-opportunities", async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      return await prisma.opportunity.findMany({
        where: {
          OR: [
            { nextCallDateLastCalculated: { lt: twentyFourHoursAgo } },
            { nextCallDateLastCalculated: null },
          ],
          stage: { notIn: ["closedWon", "closedLost"] }, // Only active opportunities
        },
        select: { id: true, name: true },
      });
    });

    console.log(`[recalculate-next-call-dates] Found ${staleOpportunities.length} stale opportunities`);

    // Step 2: Recalculate each opportunity
    let recalculated = 0;
    let updated = 0;
    let errors = 0;

    for (const opp of staleOpportunities) {
      await step.run(`recalculate-${opp.id}`, async () => {
        try {
          const result = await recalculateNextCallDateForOpportunity(opp.id);
          recalculated++;

          if (result.nextCallDate) {
            updated++;
            console.log(`[recalculate-next-call-dates] ✓ ${opp.name}: ${result.nextCallDate.toISOString()} (${result.source})`);
          }
        } catch (error) {
          errors++;
          console.error(`[recalculate-next-call-dates] ✗ ${opp.name}: Error -`, error);
        }
      });
    }

    console.log(`[recalculate-next-call-dates] Complete: ${recalculated} recalculated, ${updated} with dates, ${errors} errors`);

    return {
      recalculated,
      updated,
      errors,
    };
  }
);
