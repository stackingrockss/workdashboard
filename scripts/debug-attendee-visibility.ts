// scripts/debug-attendee-visibility.ts
// Enhanced diagnostic to check what attendee information Google Calendar API returns

import { PrismaClient } from '@prisma/client';
import { getValidAccessToken } from '../src/lib/integrations/oauth-helpers';
import { google } from 'googleapis';

const prisma = new PrismaClient();

async function debugAttendeeVisibility() {
  console.log('[Debug] Checking attendee visibility in Google Calendar API...\n');

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

    // Fetch events from October 1 to November 30, 2024
    const startDate = new Date('2024-10-01T00:00:00Z');
    const endDate = new Date('2024-11-30T23:59:59Z');

    console.log(`Fetching events from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}...\n`);

    // Try to fetch events including declined ones
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: false, // Don't show deleted events
      showHiddenInvitations: true, // Show events where user declined or didn't respond
    });

    const events = response.data.items || [];

    console.log(`✓ Fetched ${events.length} events\n`);

    // Analyze each event's attendee data structure
    console.log('--- Attendee Data Analysis ---\n');

    for (const event of events) {
      const eventDate = event.start?.dateTime || event.start?.date || 'Unknown';
      const isOrganizer = event.organizer?.self === true;
      const attendees = event.attendees || [];

      console.log(`Event: "${event.summary}"`);
      console.log(`  Date: ${new Date(eventDate).toLocaleDateString()}`);
      console.log(`  You are organizer: ${isOrganizer ? 'YES' : 'NO'}`);
      console.log(`  Organizer email: ${event.organizer?.email || 'NOT PROVIDED'}`);
      console.log(`  Number of attendees: ${attendees.length}`);

      if (attendees.length > 0) {
        console.log(`  Attendee details:`);
        attendees.forEach((attendee, idx) => {
          console.log(`    ${idx + 1}. Name: ${attendee.displayName || attendee.email || 'UNKNOWN'}`);
          console.log(`       Email: ${attendee.email || 'NOT PROVIDED'}`);
          console.log(`       Self: ${attendee.self ? 'YES' : 'NO'}`);
          console.log(`       Response: ${attendee.responseStatus || 'UNKNOWN'}`);
          console.log(`       Organizer: ${attendee.organizer ? 'YES' : 'NO'}`);
        });
      } else {
        console.log(`  No attendee data returned by API`);
      }
      console.log();
    }

    // Look specifically for the October 28 meeting
    console.log('\n--- Searching for October 28 "Intro Call" Meeting ---\n');

    const oct28Events = events.filter(event => {
      const eventDate = event.start?.dateTime || event.start?.date;
      if (!eventDate) return false;
      const date = new Date(eventDate);
      return date.getMonth() === 9 && date.getDate() === 28; // October = month 9
    });

    if (oct28Events.length === 0) {
      console.log('❌ No events found on October 28, 2024');
      console.log('   Possible reasons:');
      console.log('   1. Event is on a different calendar (not primary)');
      console.log('   2. Event was deleted or moved');
      console.log('   3. Calendar API scope is insufficient');
    } else {
      console.log(`✓ Found ${oct28Events.length} event(s) on October 28:\n`);
      oct28Events.forEach((event, idx) => {
        console.log(`${idx + 1}. "${event.summary}"`);
        console.log(`   You are organizer: ${event.organizer?.self ? 'YES' : 'NO'}`);
        console.log(`   Organizer: ${event.organizer?.email || event.organizer?.displayName || 'UNKNOWN'}`);
        console.log(`   Attendees returned by API: ${event.attendees?.length || 0}`);
        if (event.attendees && event.attendees.length > 0) {
          event.attendees.forEach((attendee, i) => {
            console.log(`     ${i + 1}. ${attendee.displayName || attendee.email || 'UNKNOWN'} (${attendee.email || 'NO EMAIL'})`);
          });
        }
        console.log();
      });
    }

    // Check for "Intro Call" specifically
    const introCallEvents = events.filter(event =>
      event.summary?.toLowerCase().includes('intro call')
    );

    if (introCallEvents.length > 0) {
      console.log('\n--- Events with "Intro Call" in title ---\n');
      introCallEvents.forEach((event, idx) => {
        const eventDate = event.start?.dateTime || event.start?.date;
        console.log(`${idx + 1}. "${event.summary}" - ${eventDate ? new Date(eventDate).toLocaleDateString() : 'Unknown'}`);
        console.log(`   Attendees: ${event.attendees?.length || 0}`);
        if (event.attendees) {
          event.attendees.forEach(a => {
            console.log(`     - ${a.displayName || 'UNKNOWN'} (${a.email || 'NO EMAIL'})`);
          });
        }
        console.log();
      });
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

debugAttendeeVisibility()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });