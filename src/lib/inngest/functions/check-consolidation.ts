// src/lib/inngest/functions/check-consolidation.ts
// Lightweight Inngest job that checks if consolidation should be triggered
// Runs separately from parsing to avoid timeout issues

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";

/**
 * Lightweight job that checks if an opportunity has enough parsed calls
 * to trigger consolidation. Runs as a separate job to avoid timeout issues
 * with the main parsing job.
 *
 * Triggered by: gong/parsing.completed event (emitted after parsing succeeds)
 */
export const checkConsolidationJob = inngest.createFunction(
  {
    id: "check-consolidation",
    name: "Check and Trigger Consolidation",
    retries: 3,
  },
  { event: "gong/parsing.completed" },
  async ({ event, step }) => {
    const { opportunityId, gongCallId } = event.data;

    // Step 1: Check how many parsed calls exist for this opportunity
    const checkResult = await step.run("check-parsed-call-count", async () => {
      const parsedCallCount = await prisma.gongCall.count({
        where: {
          opportunityId,
          parsingStatus: ParsingStatus.completed,
        },
      });

      return { parsedCallCount };
    });

    // Step 2: Trigger consolidation if we have 2+ parsed calls
    if (checkResult.parsedCallCount >= 2) {
      await step.run("trigger-consolidation", async () => {
        await inngest.send({
          name: "gong/insights.consolidate",
          data: {
            opportunityId,
          },
        });
        return { triggered: true };
      });

      return {
        success: true,
        opportunityId,
        gongCallId,
        parsedCallCount: checkResult.parsedCallCount,
        consolidationTriggered: true,
      };
    }

    return {
      success: true,
      opportunityId,
      gongCallId,
      parsedCallCount: checkResult.parsedCallCount,
      consolidationTriggered: false,
      reason: "Less than 2 parsed calls",
    };
  }
);