// scripts/debug-specific-event.ts
// Deep dive into why specific events aren't being returned

import { PrismaClient } from '@prisma/client';
import { getValidAccessToken } from '../src/lib/integrations/oauth-helpers';
import { google } from 'googleapis';

const prisma = new PrismaClient();

async function debugSpecificEvent() {
  console.log('[Debug] Deep dive into calendar event visibility...\n');

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

    // Search specifically for "Intro Call" or "Verifiable" around Oct 28, 2025
    console.log('--- Strategy 1: Query search for "Intro Call" ---\n');

    try {
      const searchResponse = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date('2025-10-01T00:00:00Z').toISOString(),
        timeMax: new Date('2025-11-30T23:59:59Z').toISOString(),
        q: 'Intro Call', // Full-text search
        maxResults: 50,
        singleEvents: true,
      });

      const searchResults = searchResponse.data.items || [];
      console.log(`Found ${searchResults.length} events matching "Intro Call":`);
      searchResults.forEach((event, idx) => {
        const date = event.start?.dateTime || event.start?.date;
        console.log(`  ${idx + 1}. "${event.summary}" - ${date ? new Date(date).toLocaleDateString() : 'Unknown'}`);
        console.log(`     Organizer: ${event.organizer?.email || 'Unknown'}`);
        console.log(`     You are organizer: ${event.organizer?.self ? 'YES' : 'NO'}`);
      });
    } catch (err) {
      console.error('Search failed:', err);
    }

    // Strategy 2: List ALL events on Oct 28, 2025 without any filters
    console.log('\n--- Strategy 2: List ALL events on Oct 28-29, 2025 (wider range) ---\n');

    const oct28Response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date('2025-10-28T00:00:00Z').toISOString(),
      timeMax: new Date('2025-10-29T23:59:59Z').toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
      showDeleted: false,
      showHiddenInvitations: true,
    });

    const oct28Events = oct28Response.data.items || [];
    console.log(`Found ${oct28Events.length} total events on Oct 28-29:\n`);

    oct28Events.forEach((event, idx) => {
      const startDate = event.start?.dateTime || event.start?.date;
      const endDate = event.end?.dateTime || event.end?.date;
      console.log(`${idx + 1}. "${event.summary}"`);
      console.log(`   ID: ${event.id}`);
      console.log(`   Start: ${startDate}`);
      console.log(`   End: ${endDate}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Visibility: ${event.visibility || 'default'}`);
      console.log(`   You are organizer: ${event.organizer?.self ? 'YES' : 'NO'}`);
      console.log(`   Organizer email: ${event.organizer?.email || 'Unknown'}`);
      console.log(`   Creator email: ${event.creator?.email || 'Unknown'}`);
      console.log(`   Attendees: ${event.attendees?.length || 0}`);
      if (event.attendees && event.attendees.length > 0) {
        event.attendees.forEach((a) => {
          console.log(`     - ${a.email} (response: ${a.responseStatus}, self: ${a.self})`);
        });
      }
      console.log();
    });

    // Strategy 3: Check primary calendar info
    console.log('\n--- Strategy 3: Check primary calendar info ---\n');

    try {
      const calendarInfo = await calendar.calendars.get({
        calendarId: 'primary',
      });
      console.log('Primary calendar details:');
      console.log(`  ID: ${calendarInfo.data.id}`);
      console.log(`  Summary: ${calendarInfo.data.summary}`);
      console.log(`  Timezone: ${calendarInfo.data.timeZone}`);
    } catch (err) {
      console.error('Could not get calendar info:', err);
    }

    // Strategy 4: Check OAuth token info
    console.log('\n--- Strategy 4: Check OAuth token info ---\n');

    const oauthRecord = await prisma.oAuthToken.findFirst({
      where: {
        userId: user.id,
        provider: 'google',
      },
      select: {
        id: true,
        provider: true,
        scopes: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
    });

    if (oauthRecord) {
      console.log('OAuth token record:');
      console.log(`  Provider: ${oauthRecord.provider}`);
      console.log(`  Scopes: ${oauthRecord.scopes || 'Not stored'}`);
      console.log(`  Created: ${oauthRecord.createdAt}`);
      console.log(`  Updated: ${oauthRecord.updatedAt}`);
      console.log(`  Expires: ${oauthRecord.expiresAt}`);
    } else {
      console.log('No OAuth token found!');
    }

    // Strategy 5: Check what calendar events we have in our database for Oct 28, 2025
    console.log('\n--- Strategy 5: Check our database for Oct 28, 2025 events ---\n');

    const dbEvents = await prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        startTime: {
          gte: new Date('2025-10-28T00:00:00Z'),
          lte: new Date('2025-10-29T23:59:59Z'),
        },
      },
      orderBy: { startTime: 'asc' },
    });

    console.log(`Found ${dbEvents.length} events in database for Oct 28-29, 2025:`);
    dbEvents.forEach((event, idx) => {
      console.log(`  ${idx + 1}. "${event.title}" - ${event.startTime.toISOString()}`);
      console.log(`     External: ${event.isExternal}`);
      console.log(`     Attendees: ${event.attendees.join(', ') || 'None'}`);
    });

    // Strategy 6: Check for any events with external attendees
    console.log('\n--- Strategy 6: All external events in database (Oct-Nov 2025) ---\n');

    const externalDbEvents = await prisma.calendarEvent.findMany({
      where: {
        userId: user.id,
        isExternal: true,
        startTime: {
          gte: new Date('2025-10-01T00:00:00Z'),
          lte: new Date('2025-11-30T23:59:59Z'),
        },
      },
      orderBy: { startTime: 'asc' },
    });

    console.log(`Found ${externalDbEvents.length} external events in database (Oct-Nov 2025):`);
    externalDbEvents.forEach((event, idx) => {
      console.log(`  ${idx + 1}. "${event.title}" - ${event.startTime.toLocaleDateString()}`);
      console.log(`     Attendees: ${event.attendees.slice(0, 3).join(', ')}${event.attendees.length > 3 ? '...' : ''}`);
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

debugSpecificEvent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });