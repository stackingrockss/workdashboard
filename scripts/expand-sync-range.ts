/**
 * Expand calendar sync time range to pull older events
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update the sync state to expand the time range
  const newTimeMin = new Date('2025-01-01T00:00:00.000Z');

  console.log('Updating calendar sync state...');
  console.log(`New Time Min: ${newTimeMin.toISOString()}`);

  const updated = await prisma.calendarSyncState.updateMany({
    data: {
      timeMin: newTimeMin,
      syncToken: null, // Clear sync token to force full re-sync
    }
  });

  console.log(`\nUpdated ${updated.count} sync state(s)`);
  console.log('Sync token cleared - next sync will be a full sync from Jan 1, 2025');

  // Verify the update
  const syncStates = await prisma.calendarSyncState.findMany({
    include: {
      user: { select: { email: true } }
    }
  });

  console.log('\nCurrent sync state:');
  for (const state of syncStates) {
    console.log(`  User: ${state.user?.email}`);
    console.log(`  Time Min: ${state.timeMin?.toISOString()}`);
    console.log(`  Time Max: ${state.timeMax?.toISOString()}`);
    console.log(`  Sync Token: ${state.syncToken ? 'Present' : 'Cleared'}`);
  }

  console.log('\nNow trigger a calendar sync to pull in older events.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
