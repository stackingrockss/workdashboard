// scripts/debug-all-calendars.ts
// Check all calendars accessible to the user, not just primary

import { PrismaClient } from '@prisma/client';
import { getValidAccessToken } from '../src/lib/integrations/oauth-helpers';
import { google } from 'googleapis';

const prisma = new PrismaClient();

async function debugAllCalendars() {
  console.log('[Debug] Checking all accessible calendars...\n');

  try {
    // Get the current user
    const users = await prisma.user.findMany({
      take: 1,
    });

    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }

    const user = users[0];
    console.log(`✓ Testing with user: ${user.email}\n`);

    // Get valid OAuth token
    const accessToken = await getValidAccessToken(user.id, 'google');

    // Initialize Google Calendar API client
    const calendar = google.calendar({
      version: 'v3',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Step 1: List all accessible calendars
    console.log('--- Step 1: Listing all accessible calendars ---\n');

    const calendarListResponse = await calendar.calendarList.list();
    const calendars = calendarListResponse.data.items || [];

    console.log(`✓ Found ${calendars.length} accessible calendars:\n`);
    calendars.forEach((cal, idx) => {
      console.log(`${idx + 1}. ${cal.summary} (${cal.id})`);
      console.log(`   - Primary: ${cal.primary ? 'YES' : 'NO'}`);
      console.log(`   - Access role: ${cal.accessRole}`);
      console.log(`   - Selected: ${cal.selected ? 'YES' : 'NO'}`);
      console.log();
    });

    // Step 2: Search for "Intro Call" event across all calendars
    console.log('\n--- Step 2: Searching for "Intro Call" event across all calendars ---\n');

    const startDate = new Date('2024-10-28T00:00:00Z');
    const endDate = new Date('2024-10-28T23:59:59Z');

    for (const cal of calendars) {
      try {
        console.log(`Searching calendar: "${cal.summary}" (${cal.id})...`);

        const eventsResponse = await calendar.events.list({
          calendarId: cal.id,
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          maxResults: 50,
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = eventsResponse.data.items || [];
        console.log(`  - Found ${events.length} events on Oct 28\n`);

        if (events.length > 0) {
          events.forEach((event, idx) => {
            const eventDate = event.start?.dateTime || event.start?.date || 'Unknown';
            console.log(`    ${idx + 1}. "${event.summary}"`);
            console.log(`       Time: ${new Date(eventDate).toLocaleString()}`);
            console.log(`       You are organizer: ${event.organizer?.self ? 'YES' : 'NO'}`);
            console.log(`       Organizer: ${event.organizer?.email || event.organizer?.displayName || 'UNKNOWN'}`);
            console.log(`       Attendees: ${event.attendees?.length || 0}`);

            if (event.attendees && event.attendees.length > 0) {
              console.log(`       Attendee emails:`);
              event.attendees.forEach(a => {
                console.log(`         - ${a.email || a.displayName || 'UNKNOWN'}`);
              });
            }
            console.log();
          });
        }
      } catch (error) {
        console.error(`  ❌ Error accessing calendar "${cal.summary}":`, error instanceof Error ? error.message : String(error));
        console.log();
      }
    }

    // Step 3: Search for events with "Centene" in title or attendees
    console.log('\n--- Step 3: Searching for any events with "Centene" ---\n');

    const searchStartDate = new Date('2024-10-01T00:00:00Z');
    const searchEndDate = new Date('2024-11-30T23:59:59Z');

    for (const cal of calendars) {
      try {
        const eventsResponse = await calendar.events.list({
          calendarId: cal.id,
          timeMin: searchStartDate.toISOString(),
          timeMax: searchEndDate.toISOString(),
          q: 'centene', // Search query
          maxResults: 50,
          singleEvents: true,
        });

        const events = eventsResponse.data.items || [];

        if (events.length > 0) {
          console.log(`✓ Found ${events.length} event(s) matching "centene" in calendar "${cal.summary}":\n`);
          events.forEach((event, idx) => {
            const eventDate = event.start?.dateTime || event.start?.date || 'Unknown';
            console.log(`  ${idx + 1}. "${event.summary}"`);
            console.log(`     Date: ${new Date(eventDate).toLocaleDateString()}`);
            console.log(`     Organizer: ${event.organizer?.email || 'UNKNOWN'}`);
            console.log(`     Attendees: ${event.attendees?.length || 0}`);
            if (event.attendees) {
              event.attendees.forEach(a => {
                console.log(`       - ${a.email || a.displayName || 'UNKNOWN'}`);
              });
            }
            console.log();
          });
        }
      } catch (error) {
        // Skip calendars that don't support search
      }
    }

  } catch (error) {
    console.error('[Debug] Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

debugAllCalendars()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });