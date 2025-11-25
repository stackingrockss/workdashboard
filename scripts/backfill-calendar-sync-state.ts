// scripts/backfill-calendar-sync-state.ts
// Backfill CalendarSyncState for users with existing Google OAuth tokens

import { prisma } from '../src/lib/db';

async function backfillCalendarSyncState() {
  console.log('🚀 Starting CalendarSyncState backfill...\n');

  try {
    // Find all users with Google OAuth tokens
    const usersWithGoogleOAuth = await prisma.oAuthToken.findMany({
      where: { provider: 'google' },
      include: { user: true },
    });

    console.log(`Found ${usersWithGoogleOAuth.length} users with Google OAuth tokens\n`);

    if (usersWithGoogleOAuth.length === 0) {
      console.log('✅ No users to backfill');
      return;
    }

    // Calculate default date range: 90 days past to 90 days future
    const now = new Date();
    const defaultTimeMin = new Date(now);
    defaultTimeMin.setDate(defaultTimeMin.getDate() - 90);
    const defaultTimeMax = new Date(now);
    defaultTimeMax.setDate(defaultTimeMax.getDate() + 90);

    let createdCount = 0;
    let skippedCount = 0;

    for (const token of usersWithGoogleOAuth) {
      // Check if CalendarSyncState already exists
      const existing = await prisma.calendarSyncState.findUnique({
        where: {
          userId_provider: {
            userId: token.userId,
            provider: 'google',
          },
        },
      });

      if (existing) {
        console.log(`⏭️  Skipping user ${token.user.email} - sync state already exists`);
        skippedCount++;
        continue;
      }

      // Create CalendarSyncState with null syncToken (will trigger initial full sync)
      await prisma.calendarSyncState.create({
        data: {
          userId: token.userId,
          provider: 'google',
          syncToken: null, // Null token triggers full sync on first run
          timeMin: defaultTimeMin,
          timeMax: defaultTimeMax,
          lastSyncAt: null,
          lastSyncStatus: null,
          lastSyncError: null,
        },
      });

      console.log(`✅ Created CalendarSyncState for user ${token.user.email}`);
      createdCount++;
    }

    console.log(`\n📊 Backfill Summary:`);
    console.log(`   - Created: ${createdCount}`);
    console.log(`   - Skipped: ${skippedCount}`);
    console.log(`   - Total: ${usersWithGoogleOAuth.length}`);
    console.log('\n✅ Backfill complete!');
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillCalendarSyncState()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
