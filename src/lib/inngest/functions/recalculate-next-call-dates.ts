// src/lib/inngest/functions/recalculate-next-call-dates.ts
// Inngest background job for recalculating opportunity dates including CBC

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { recalculateOpportunityDates } from "@/lib/utils/next-call-date-calculator";

/**
 * Background job that recalculates all opportunity dates (last call, next call, CBC)
 * Ensures consistency by recalculating dates that are >24 hours old or never calculated
 * Runs daily at 2 AM (off-peak hours)
 */
export const recalculateNextCallDatesJob = inngest.createFunction(
  {
    id: "recalculate-next-call-dates",
    name: "Recalculate Opportunity Dates (CBC)",
    retries: 1,
  },
  { cron: "0 2 * * *" }, // Daily at 2 AM
  async ({ step }) => {
    // Step 1: Find opportunities with stale date calculations
    const staleOpportunities = await step.run("find-stale-opportunities", async () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      return await prisma.opportunity.findMany({
        where: {
          OR: [
            { cbcLastCalculated: { lt: twentyFourHoursAgo } },
            { cbcLastCalculated: null },
            { nextCallDateLastCalculated: { lt: twentyFourHoursAgo } },
            { nextCallDateLastCalculated: null },
          ],
          stage: { notIn: ["closedWon", "closedLost"] }, // Only active opportunities
        },
        select: { id: true, name: true },
      });
    });

    console.log(`[recalculate-dates] Found ${staleOpportunities.length} stale opportunities`);

    // Step 2: Recalculate each opportunity
    let recalculated = 0;
    let withCbc = 0;
    let needsNextCall = 0;
    let errors = 0;

    for (const opp of staleOpportunities) {
      await step.run(`recalculate-${opp.id}`, async () => {
        try {
          const result = await recalculateOpportunityDates(opp.id);
          recalculated++;

          if (result.cbcDate) {
            withCbc++;
            console.log(
              `[recalculate-dates] ✓ ${opp.name}: CBC=${result.cbcDate.toISOString()}, ` +
              `Last=${result.lastCallDate?.toISOString() || 'none'}, ` +
              `Next=${result.nextCallDate?.toISOString() || 'none'}`
            );
          }

          if (result.needsNextCallScheduled) {
            needsNextCall++;
            console.log(`[recalculate-dates] ⚠ ${opp.name}: Needs next call scheduled`);
          }
        } catch (error) {
          errors++;
          console.error(`[recalculate-dates] ✗ ${opp.name}: Error -`, error);
        }
      });
    }

    console.log(
      `[recalculate-dates] Complete: ${recalculated} processed, ` +
      `${withCbc} with CBC dates, ${needsNextCall} need next call, ${errors} errors`
    );

    return {
      recalculated,
      withCbc,
      needsNextCall,
      errors,
    };
  }
);

/**
 * Event-triggered recalculation for a single opportunity
 * Called when meetings are added/updated/deleted
 */
export const recalculateOpportunityDatesEvent = inngest.createFunction(
  {
    id: "recalculate-opportunity-dates-event",
    name: "Recalculate Opportunity Dates (Event)",
    retries: 2,
  },
  { event: "opportunity/dates.recalculate" },
  async ({ event, step }) => {
    const { opportunityId, trigger } = event.data as {
      opportunityId: string;
      trigger: string;
    };

    console.log(`[recalculate-dates-event] Triggered by ${trigger} for opportunity ${opportunityId}`);

    const result = await step.run("recalculate-dates", async () => {
      return await recalculateOpportunityDates(opportunityId);
    });

    console.log(
      `[recalculate-dates-event] ✓ CBC=${result.cbcDate || 'none'}, ` +
      `needsNextCall=${result.needsNextCallScheduled}`
    );

    return result;
  }
);
