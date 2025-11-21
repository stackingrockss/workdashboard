// src/app/api/v1/integrations/google/calendar/sync/route.ts
// Manual trigger API for syncing calendar events immediately

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { googleCalendarClient, type CalendarEventData } from '@/lib/integrations/google-calendar';
import { getValidAccessToken } from '@/lib/integrations/oauth-helpers';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/v1/integrations/google/calendar/sync
 *
 * Manually triggers a calendar sync for the authenticated user.
 * This is useful for:
 * - Initial sync after connecting calendar
 * - Forcing a refresh when events aren't showing up
 * - Recalculating isExternal after organization domain changes
 *
 * @returns Sync status and statistics
 */
export async function POST() {
  try {
    // 1. Authenticate user
    const user = await requireAuth();

    // 2. Check if user has Google Calendar connected
    const oauthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google',
        },
      },
    });

    if (!oauthToken) {
      return NextResponse.json(
        { error: 'Google Calendar not connected' },
        { status: 400 }
      );
    }

    // 3. Validate and refresh access token if needed
    try {
      await getValidAccessToken(user.id, 'google');
    } catch {
      return NextResponse.json(
        { error: 'Failed to validate access token. Please reconnect your calendar.' },
        { status: 401 }
      );
    }

    // 4. Define date ranges: Fetch future events first (priority), then past events
    const now = new Date();
    const pastStartDate = new Date(now);
    pastStartDate.setDate(pastStartDate.getDate() - 90);
    const futureEndDate = new Date(now);
    futureEndDate.setDate(futureEndDate.getDate() + 90);

    console.log(`[Calendar Sync] Starting manual sync for user ${user.id}`);

    // 5a. First, fetch FUTURE events (today onwards) - PRIORITY
    let allEvents: CalendarEventData[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    const maxPagesPerRange = 10; // Max 10 pages per date range

    console.log(`[Calendar Sync] Fetching future events (${now.toISOString()} to ${futureEndDate.toISOString()})`);

    do {
      const response = await googleCalendarClient.listEvents(
        user.id,
        now, // Start from today
        futureEndDate,
        {
          externalOnly: false,
          pageToken,
          maxResults: 50,
        }
      );

      allEvents = allEvents.concat(response.events);
      pageToken = response.nextPageToken;
      pageCount++;
    } while (pageToken && pageCount < maxPagesPerRange);

    console.log(`[Calendar Sync] Fetched ${allEvents.length} future events`);

    // 5b. Then, fetch PAST events (if we have room)
    if (pageCount < maxPagesPerRange) {
      pageToken = undefined;

      console.log(`[Calendar Sync] Fetching past events (${pastStartDate.toISOString()} to ${now.toISOString()})`);

      let pastEventCount = 0;
      do {
        const response = await googleCalendarClient.listEvents(
          user.id,
          pastStartDate,
          now,
          {
            externalOnly: false,
            pageToken,
            maxResults: 50,
          }
        );

        allEvents = allEvents.concat(response.events);
        pageToken = response.nextPageToken;
        pageCount++;
        pastEventCount += response.events.length;
      } while (pageToken && pageCount < maxPagesPerRange);

      console.log(`[Calendar Sync] Fetched ${pastEventCount} past events`);
    }

    console.log(`[Calendar Sync] Total fetched: ${allEvents.length} events from Google Calendar`);

    if (allEvents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No events found in date range',
        stats: {
          eventsProcessed: 0,
          eventsCreated: 0,
          eventsUpdated: 0,
          eventsDeleted: 0,
        },
      });
    }

    // 6. Extract Google event IDs for cleanup
    const googleEventIds = allEvents.map(event => event.id);

    // 7. Upsert events into database
    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (const event of allEvents) {
      try {
        const existingEvent = await prisma.calendarEvent.findUnique({
          where: {
            userId_googleEventId: {
              userId: user.id,
              googleEventId: event.id,
            },
          },
        });

        await prisma.calendarEvent.upsert({
          where: {
            userId_googleEventId: {
              userId: user.id,
              googleEventId: event.id,
            },
          },
          update: {
            summary: event.summary,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            attendees: event.attendees,
            isExternal: event.isExternal,
            organizerEmail: event.organizerEmail,
            meetingUrl: event.meetingUrl,
            // Note: opportunityId and accountId are NOT updated here
            // Those are set manually via UI linking functionality
          },
          create: {
            userId: user.id,
            googleEventId: event.id,
            summary: event.summary,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            attendees: event.attendees,
            isExternal: event.isExternal,
            organizerEmail: event.organizerEmail,
            meetingUrl: event.meetingUrl,
          },
        });

        if (existingEvent) {
          updatedCount++;
        } else {
          createdCount++;
        }
      } catch (error) {
        console.error(`Failed to upsert event ${event.id}:`, error);
        errors.push(`Failed to sync event: ${event.summary}`);
      }
    }

    // 8. Delete stale events (events not in Google API response within date range)
    // Only delete events created more than 1 minute ago to avoid race conditions
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const deleteResult = await prisma.calendarEvent.deleteMany({
      where: {
        userId: user.id,
        googleEventId: {
          notIn: googleEventIds,
        },
        startTime: {
          gte: pastStartDate,
          lte: futureEndDate,
        },
        createdAt: {
          lt: oneMinuteAgo,
        },
      },
    });

    console.log(
      `[Calendar Sync] Completed: ${createdCount} created, ${updatedCount} updated, ${deleteResult.count} deleted`
    );

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${allEvents.length} events`,
      stats: {
        eventsProcessed: allEvents.length,
        eventsCreated: createdCount,
        eventsUpdated: updatedCount,
        eventsDeleted: deleteResult.count,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

  } catch (error) {
    console.error('[Calendar Sync] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync calendar events',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
