// scripts/debug-google-calendar-fetch.ts
// Debug script to see what Google Calendar API is returning

import { PrismaClient } from '@prisma/client';
import { googleCalendarClient } from '../src/lib/integrations/google-calendar';

const prisma = new PrismaClient();

async function debugGoogleCalendarFetch() {
  console.log('[Debug] Checking what Google Calendar API returns...\n');

  try {
    // Get the current user (assuming single user for now)
    const users = await prisma.user.findMany({
      take: 1,
    });

    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }

    const user = users[0];
    console.log(`✓ Testing with user: ${user.email}`);

    // Define date range: 90 days past to 90 days future
    const now = new Date();
    const pastStartDate = new Date(now);
    pastStartDate.setDate(pastStartDate.getDate() - 90);
    const futureEndDate = new Date(now);
    futureEndDate.setDate(futureEndDate.getDate() + 90);

    console.log(`\nDate range:`);
    console.log(`  - From: ${pastStartDate.toLocaleDateString()}`);
    console.log(`  - To: ${futureEndDate.toLocaleDateString()}`);
    console.log(`  - (${Math.floor((futureEndDate.getTime() - pastStartDate.getTime()) / (1000 * 60 * 60 * 24))} days total)\n`);

    // Fetch ALL events (not just external)
    console.log('Fetching events from Google Calendar API...\n');

    const result = await googleCalendarClient.listEvents(
      user.id,
      pastStartDate,
      futureEndDate,
      {
        externalOnly: false, // Get ALL events
        maxResults: 100,
      }
    );

    console.log(`✓ Fetched ${result.events.length} events from Google Calendar\n`);

    // Filter for Centene events
    const centeneEvents = result.events.filter((event) =>
      event.attendees.some((email) => email.toLowerCase().includes('centene.com'))
    );

    console.log(`✓ Found ${centeneEvents.length} events with @centene.com attendees:\n`);

    centeneEvents.forEach((event, index) => {
      console.log(`${index + 1}. "${event.summary}"`);
      console.log(`   - Date: ${event.startTime.toLocaleString()}`);
      console.log(`   - Attendees: ${event.attendees.join(', ')}`);
      console.log(`   - External: ${event.isExternal ? 'Yes' : 'No'}`);
      console.log();
    });

    if (centeneEvents.length === 0) {
      console.log('⚠️  No Centene events found in Google Calendar API response');
      console.log('   This means:');
      console.log('   1. The meetings might not have @centene.com attendees');
      console.log('   2. The meetings might be outside the 90-day window');
      console.log('   3. The meetings might be on a different calendar');
      console.log('   4. Google Calendar API might not be returning them for some reason\n');
    }

    // Show sample of all events for context
    console.log(`\n--- Sample of all events (first 10) ---\n`);
    result.events.slice(0, 10).forEach((event, index) => {
      console.log(`${index + 1}. "${event.summary}" - ${event.startTime.toLocaleDateString()}`);
      console.log(`   Attendees: ${event.attendees.length} (${event.attendees.slice(0, 3).join(', ')}${event.attendees.length > 3 ? '...' : ''})`);
    });

  } catch (error) {
    console.error('[Debug] Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

debugGoogleCalendarFetch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
