/**
 * Check OAuth connection status for calendar integration
 *
 * Run with: npx tsx scripts/check-oauth-status.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOAuthStatus() {
  console.log('🔐 Checking OAuth Connection Status\n');
  console.log('='.repeat(60));

  try {
    // Check OAuth tokens
    const tokens = await prisma.oAuthToken.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
            organizationId: true,
            organization: {
              select: {
                name: true,
                domain: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (tokens.length === 0) {
      console.log('❌ No OAuth tokens found');
      console.log('\n→ Calendar has not been connected yet');
      console.log('→ Go to /settings/integrations to connect Google Calendar');
      return;
    }

    console.log(`✓ Found ${tokens.length} OAuth token(s):\n`);

    const now = new Date();

    tokens.forEach((token, idx) => {
      console.log(`${idx + 1}. Provider: ${token.provider.toUpperCase()}`);
      console.log(`   User: ${token.user.name || token.user.email}`);
      console.log(`   Organization: ${token.user.organization?.name || 'N/A'}`);
      console.log(`   Org Domain: ${token.user.organization?.domain || '⚠️  NOT SET'}`);
      console.log(`   Scopes: ${token.scopes.join(', ')}`);
      console.log(`   Created: ${token.createdAt.toLocaleString()}`);
      console.log(`   Expires: ${token.expiresAt.toLocaleString()}`);

      const isExpired = token.expiresAt < now;
      if (isExpired) {
        console.log(`   Status: ⚠️  EXPIRED (will auto-refresh on next use)`);
      } else {
        const minutesUntilExpiry = Math.floor((token.expiresAt.getTime() - now.getTime()) / 60000);
        console.log(`   Status: ✓ VALID (expires in ${minutesUntilExpiry} minutes)`);
      }

      if (!token.user.organization?.domain) {
        console.log(`   ⚠️  WARNING: Organization domain not set - external meetings won't be detected!`);
      }

      console.log();
    });

    // Check if there are any calendar events
    const eventCount = await prisma.calendarEvent.count();
    console.log(`\n📅 Calendar Events: ${eventCount}`);

    if (eventCount === 0 && tokens.length > 0) {
      console.log('\n🟡 Calendar is connected but no events have been synced yet');
      console.log('\nPossible reasons:');
      console.log('  1. Initial sync has not run yet (runs every 15 minutes)');
      console.log('  2. User has no calendar events');
      console.log('  3. Sync job may have failed');
      console.log('\nTo manually trigger a sync:');
      console.log('  → Wait for the next scheduled run (every 15 minutes)');
      console.log('  → Or check the sync job logs in your background job dashboard');
    }

    console.log('\n✓ OAuth status check complete!\n');

  } catch (error) {
    console.error('\n❌ Error checking OAuth status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkOAuthStatus().catch(console.error);
