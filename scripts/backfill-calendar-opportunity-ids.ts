// scripts/backfill-calendar-opportunity-ids.ts
// One-time migration script to backfill opportunityId for calendar events
// that are linked to accounts with exactly 1 opportunity

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillOpportunityIds() {
  console.log('[Backfill] Starting calendar event opportunityId backfill...');

  try {
    // Find all calendar events that have accountId but no opportunityId
    const eventsToUpdate = await prisma.calendarEvent.findMany({
      where: {
        accountId: { not: null },
        opportunityId: null,
      },
      select: {
        id: true,
        accountId: true,
        summary: true,
      },
    });

    console.log(`[Backfill] Found ${eventsToUpdate.length} events to process`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const event of eventsToUpdate) {
      if (!event.accountId) continue;

      // Get the account and its opportunities
      const account = await prisma.account.findUnique({
        where: { id: event.accountId },
        include: {
          opportunities: {
            select: { id: true, name: true },
          },
        },
      });

      if (!account) {
        console.warn(`[Backfill] Account ${event.accountId} not found for event ${event.id}`);
        skippedCount++;
        continue;
      }

      // If account has exactly 1 opportunity, link it
      if (account.opportunities.length === 1) {
        await prisma.calendarEvent.update({
          where: { id: event.id },
          data: { opportunityId: account.opportunities[0].id },
        });

        console.log(
          `[Backfill] ✓ Linked event "${event.summary}" to opportunity "${account.opportunities[0].name}"`
        );
        updatedCount++;
      } else if (account.opportunities.length > 1) {
        // Try to match by meeting title
        const meetingTitle = event.summary.toLowerCase();
        const matchedOpp = account.opportunities.find(
          (opp) =>
            meetingTitle.includes(opp.name.toLowerCase()) ||
            opp.name.toLowerCase().includes(meetingTitle)
        );

        if (matchedOpp) {
          await prisma.calendarEvent.update({
            where: { id: event.id },
            data: { opportunityId: matchedOpp.id },
          });

          console.log(
            `[Backfill] ✓ Linked event "${event.summary}" to opportunity "${matchedOpp.name}" (by title match)`
          );
          updatedCount++;
        } else {
          console.log(
            `[Backfill] ⊘ Skipped event "${event.summary}" - account has ${account.opportunities.length} opportunities but no title match`
          );
          skippedCount++;
        }
      } else {
        console.log(
          `[Backfill] ⊘ Skipped event "${event.summary}" - account has no opportunities`
        );
        skippedCount++;
      }
    }

    console.log('\n[Backfill] Summary:');
    console.log(`  - Total events processed: ${eventsToUpdate.length}`);
    console.log(`  - Events updated: ${updatedCount}`);
    console.log(`  - Events skipped: ${skippedCount}`);
    console.log('\n[Backfill] ✓ Backfill complete!');

    return {
      success: true,
      totalProcessed: eventsToUpdate.length,
      updated: updatedCount,
      skipped: skippedCount,
    };
  } catch (error) {
    console.error('[Backfill] Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillOpportunityIds()
  .then((result) => {
    console.log('\n[Backfill] Result:', result);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[Backfill] Fatal error:', error);
    process.exit(1);
  });
