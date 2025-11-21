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

    // 4. Define date range: 90 days past to 90 days future
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 90);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 90);

    // 5. Fetch all events from Google Calendar API
    let allEvents: CalendarEventData[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    const maxPages = 10; // Safety limit: max 10 pages (500 events)

    console.log(`[Calendar Sync] Starting manual sync for user ${user.id}`);

    do {
      const response = await googleCalendarClient.listEvents(
        user.id,
        startDate,
        endDate,
        {
          externalOnly: false, // Sync all events, not just external
          pageToken,
          maxResults: 50,
        }
      );

      allEvents = allEvents.concat(response.events);
      pageToken = response.nextPageToken;
      pageCount++;
    } while (pageToken && pageCount < maxPages);

    console.log(`[Calendar Sync] Fetched ${allEvents.length} events from Google Calendar`);

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
          gte: startDate,
          lte: endDate,
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
