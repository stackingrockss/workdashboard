// scripts/check-sync-state.ts
// Check calendar sync state and identify gaps

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSyncState() {
  console.log('[Sync State] Checking calendar sync state...\n');

  try {
    // Check sync states
    const syncStates = await prisma.calendarSyncState.findMany({
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    console.log(`Found ${syncStates.length} sync state(s):\n`);
    syncStates.forEach((state, i) => {
      console.log(`${i + 1}. User: ${state.user?.email || 'Unknown'}`);
      console.log(`   Last Sync: ${state.lastSyncAt?.toISOString() || 'Never'}`);
      console.log(`   Sync Token: ${state.syncToken ? 'Present' : 'None'}`);
      console.log(`   Time Min: ${state.timeMin?.toISOString() || 'None'}`);
      console.log(`   Time Max: ${state.timeMax?.toISOString() || 'None'}`);
      console.log(`   Last Status: ${state.lastSyncStatus || 'None'}`);
      console.log(`   Last Error: ${state.lastSyncError || 'None'}`);
      console.log(`   Created: ${state.createdAt.toISOString()}`);
      console.log(`   Updated: ${state.updatedAt.toISOString()}`);
      console.log();
    });

    // Check date range of events in database
    const events = await prisma.calendarEvent.findMany({
      orderBy: { startTime: 'asc' },
      select: { startTime: true },
    });

    if (events.length > 0) {
      const earliest = events[0].startTime;
      const latest = events[events.length - 1].startTime;
      console.log(`\nEvents in database:`);
      console.log(`  Total: ${events.length}`);
      console.log(`  Earliest: ${earliest.toISOString().split('T')[0]}`);
      console.log(`  Latest: ${latest.toISOString().split('T')[0]}`);

      // Check for gaps
      console.log('\n--- Checking for date gaps ---\n');
      let lastDate = new Date(earliest);
      const gaps: { from: Date; to: Date }[] = [];

      events.forEach((event) => {
        const eventDate = new Date(event.startTime);
        const diffDays = Math.floor(
          (eventDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (diffDays > 7) {
          // More than a week gap
          gaps.push({
            from: new Date(lastDate),
            to: new Date(eventDate),
          });
        }

        lastDate = eventDate;
      });

      if (gaps.length > 0) {
        console.log(`Found ${gaps.length} gap(s) larger than 7 days:`);
        gaps.forEach((gap, i) => {
          const days = Math.floor(
            (gap.to.getTime() - gap.from.getTime()) / (1000 * 60 * 60 * 24)
          );
          console.log(
            `  ${i + 1}. ${gap.from.toISOString().split('T')[0]} to ${gap.to.toISOString().split('T')[0]} (${days} days)`
          );
        });
      } else {
        console.log('No significant gaps found.');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkSyncState();
