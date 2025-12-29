// scripts/backfill-cbc-dates.ts
// One-time script to recalculate CBC dates for all active opportunities

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Import the calculation functions directly to avoid module resolution issues
async function recalculateOpportunityDates(opportunityId: string) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      calendarEvents: {
        where: { isExternal: true },
        orderBy: { startTime: "asc" },
      },
      gongCalls: { orderBy: { meetingDate: "asc" } },
      granolaNotes: { orderBy: { meetingDate: "asc" } },
    },
  });

  if (!opportunity) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }

  const now = new Date();

  // Collect all meetings
  type MeetingData = { date: Date; source: string; eventId: string };
  const meetings: MeetingData[] = [];

  opportunity.calendarEvents?.forEach((e) =>
    meetings.push({ date: e.startTime, source: "auto_calendar", eventId: e.id })
  );
  opportunity.gongCalls?.forEach((c) =>
    meetings.push({ date: c.meetingDate, source: "auto_gong", eventId: c.id })
  );
  opportunity.granolaNotes?.forEach((n) =>
    meetings.push({ date: n.meetingDate, source: "auto_granola", eventId: n.id })
  );

  // Calculate last call (most recent past meeting)
  const pastMeetings = meetings.filter((m) => m.date <= now);
  pastMeetings.sort((a, b) => b.date.getTime() - a.date.getTime());
  const lastCall = pastMeetings[0] || null;

  // Calculate next call (earliest future meeting)
  const futureMeetings = meetings.filter((m) => m.date > now);
  futureMeetings.sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextCall = futureMeetings[0] || null;

  // Calculate CBC (midpoint)
  let cbcDate: Date | null = null;
  if (lastCall && nextCall) {
    const gapMs = nextCall.date.getTime() - lastCall.date.getTime();
    if (gapMs > 0) {
      cbcDate = new Date(lastCall.date.getTime() + gapMs / 2);
    }
  }

  // needsNextCallScheduled = no future meeting
  const needsNextCallScheduled = nextCall === null;

  const calculatedAt = new Date();

  // Update database
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      lastCallDate: lastCall?.date || null,
      lastCallDateSource: lastCall?.source as any || null,
      lastCallDateEventId: lastCall?.eventId || null,
      nextCallDate: nextCall?.date || null,
      nextCallDateSource: nextCall?.source as any || null,
      nextCallDateLastCalculated: calculatedAt,
      nextCallDateEventId: nextCall?.eventId || null,
      cbc: cbcDate,
      cbcLastCalculated: calculatedAt,
      needsNextCallScheduled,
    },
  });

  return {
    lastCallDate: lastCall?.date || null,
    nextCallDate: nextCall?.date || null,
    cbcDate,
    needsNextCallScheduled,
  };
}

async function backfillCbcDates() {
  console.log("[Backfill CBC] Starting CBC date backfill...");

  try {
    // Find all active opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: {
        stage: { notIn: ["closedWon", "closedLost"] },
      },
      select: { id: true, name: true },
    });

    console.log(`[Backfill CBC] Found ${opportunities.length} active opportunities`);

    let processed = 0;
    let withNextCall = 0;
    let needsNextCall = 0;
    let withCbc = 0;
    let errors = 0;

    for (const opp of opportunities) {
      try {
        const result = await recalculateOpportunityDates(opp.id);
        processed++;

        if (result.nextCallDate) {
          withNextCall++;
        }
        if (result.needsNextCallScheduled) {
          needsNextCall++;
        }
        if (result.cbcDate) {
          withCbc++;
        }

        console.log(
          `[Backfill CBC] ✓ ${opp.name}: ` +
            `last=${result.lastCallDate?.toISOString().split("T")[0] || "none"}, ` +
            `next=${result.nextCallDate?.toISOString().split("T")[0] || "none"}, ` +
            `cbc=${result.cbcDate?.toISOString().split("T")[0] || "none"}, ` +
            `needsNext=${result.needsNextCallScheduled}`
        );
      } catch (error) {
        errors++;
        console.error(`[Backfill CBC] ✗ ${opp.name}: Error -`, error);
      }
    }

    console.log("\n[Backfill CBC] Summary:");
    console.log(`  - Total processed: ${processed}`);
    console.log(`  - With next call scheduled: ${withNextCall}`);
    console.log(`  - Needs next call: ${needsNextCall}`);
    console.log(`  - With CBC date: ${withCbc}`);
    console.log(`  - Errors: ${errors}`);
    console.log("\n[Backfill CBC] ✓ Backfill complete!");

    return {
      success: true,
      processed,
      withNextCall,
      needsNextCall,
      withCbc,
      errors,
    };
  } catch (error) {
    console.error("[Backfill CBC] Fatal error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillCbcDates()
  .then((result) => {
    console.log("\n[Backfill CBC] Result:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n[Backfill CBC] Fatal error:", error);
    process.exit(1);
  });
