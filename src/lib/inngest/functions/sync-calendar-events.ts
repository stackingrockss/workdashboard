// src/lib/inngest/functions/sync-calendar-events.ts
// Inngest background job for syncing Google Calendar events to database

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { googleCalendarClient, type CalendarEventData } from "@/lib/integrations/google-calendar";
import { getValidAccessToken } from "@/lib/integrations/oauth-helpers";

/**
 * Background job that syncs calendar events for all users with connected Google Calendars
 * Runs every 15 minutes via cron schedule
 * Stores events in CalendarEvent table for fast database queries
 */
export const syncAllCalendarEventsJob = inngest.createFunction(
  {
    id: "sync-all-calendar-events",
    name: "Sync All Calendar Events",
    retries: 2, // Retry entire batch up to 2 times on infrastructure failures
  },
  { cron: "0 */15 * * *" }, // Every 15 minutes
  async ({ step }) => {
    // Step 1: Fetch all users with active Google OAuth tokens
    const usersWithCalendar = await step.run("fetch-users-with-calendar", async () => {
      const users = await prisma.oAuthToken.findMany({
        where: {
          provider: "google",
        },
        select: {
          userId: true,
          expiresAt: true,
        },
      });

      return users.map(u => u.userId);
    });

    if (usersWithCalendar.length === 0) {
      return {
        success: true,
        message: "No users with Google Calendar connected",
        totalUsers: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
      };
    }

    let successfulSyncs = 0;
    let failedSyncs = 0;
    const syncErrors: Array<{ userId: string; error: string }> = [];

    // Step 2: Sync each user sequentially with individual error handling
    for (const userId of usersWithCalendar) {
      await step.run(`sync-user-${userId}`, async () => {
        try {
          // Calculate date range: 90 days past to 90 days future
          const now = new Date();
          const startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 90);
          const endDate = new Date(now);
          endDate.setDate(endDate.getDate() + 90);

          // Validate access token (auto-refreshes if expired)
          try {
            await getValidAccessToken(userId, "google");
          } catch {
            // Token expired or revoked, skip this user
            console.warn(`User ${userId}: Calendar not connected or token invalid`);
            failedSyncs++;
            syncErrors.push({
              userId,
              error: "Token invalid or expired",
            });
            return { skipped: true, reason: "Token invalid" };
          }

          // Fetch events from Google Calendar API
          let allEvents: CalendarEventData[] = [];
          let pageToken: string | undefined = undefined;
          let pageCount = 0;
          const maxPages = 10; // Safety limit: max 10 pages (500 events)

          do {
            const response = await googleCalendarClient.listEvents(
              userId,
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

          if (allEvents.length === 0) {
            console.log(`User ${userId}: No events found in date range`);
            successfulSyncs++;
            return {
              success: true,
              eventsProcessed: 0,
              eventsDeleted: 0,
            };
          }

          // Extract Google event IDs from API response
          const googleEventIds = allEvents.map(event => event.id);

          // Upsert events into database
          let upsertedCount = 0;
          for (const event of allEvents) {
            try {
              await prisma.calendarEvent.upsert({
                where: {
                  userId_googleEventId: {
                    userId,
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
                  userId,
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
              upsertedCount++;
            } catch (error) {
              console.error(`Failed to upsert event ${event.id} for user ${userId}:`, error);
              // Continue to next event instead of failing entire sync
            }
          }

          // Delete stale events (events not in Google API response within date range)
          // Only delete events created more than 1 minute ago to avoid race conditions
          // with concurrent POST requests
          const oneMinuteAgo = new Date(Date.now() - 60000);
          const deleteResult = await prisma.calendarEvent.deleteMany({
            where: {
              userId,
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
            `User ${userId}: Synced ${upsertedCount} events, deleted ${deleteResult.count} stale events`
          );

          successfulSyncs++;
          return {
            success: true,
            eventsProcessed: upsertedCount,
            eventsDeleted: deleteResult.count,
          };
        } catch (error) {
          console.error(`Failed to sync calendar for user ${userId}:`, error);
          failedSyncs++;
          syncErrors.push({
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });
    }

    // Return summary
    return {
      success: true,
      totalUsers: usersWithCalendar.length,
      successfulSyncs,
      failedSyncs,
      syncErrors: syncErrors.length > 0 ? syncErrors : undefined,
    };
  }
);
