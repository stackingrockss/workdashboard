// src/lib/inngest/functions/sync-calendar-events.ts
// Inngest background job for syncing Google Calendar events to database

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import { googleCalendarClient, type CalendarEventData } from "@/lib/integrations/google-calendar";
import { getValidAccessToken } from "@/lib/integrations/oauth-helpers";

/**
 * Recalculates the isExternal flag for all calendar events for a given organization
 * This should be called when the organization domain changes
 */
export async function recalculateExternalEventsForOrganization(organizationId: string): Promise<{
  success: boolean;
  eventsProcessed: number;
  eventsUpdated: number;
  error?: string;
}> {
  try {
    // 1. Get organization domain
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { domain: true },
    });

    if (!org) {
      return {
        success: false,
        eventsProcessed: 0,
        eventsUpdated: 0,
        error: "Organization not found",
      };
    }

    if (!org.domain) {
      return {
        success: false,
        eventsProcessed: 0,
        eventsUpdated: 0,
        error: "Organization domain not set",
      };
    }

    const organizationDomain = org.domain.toLowerCase();

    // 2. Get all users in the organization
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      return {
        success: true,
        eventsProcessed: 0,
        eventsUpdated: 0,
      };
    }

    const userIds = users.map(u => u.id);
    const userEmailMap = new Map(users.map(u => [u.id, u.email.toLowerCase()]));

    // 3. Fetch all calendar events for these users
    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: { in: userIds },
      },
      select: {
        id: true,
        userId: true,
        attendees: true,
        isExternal: true,
      },
    });

    let eventsUpdated = 0;

    // 4. Recalculate isExternal for each event
    for (const event of events) {
      const userEmail = userEmailMap.get(event.userId);
      if (!userEmail) continue;

      // Filter out current user's email
      const otherAttendees = event.attendees.filter(
        email => email.toLowerCase() !== userEmail
      );

      // Calculate if event should be external
      const shouldBeExternal = otherAttendees.length > 0 && otherAttendees.some((email) => {
        const emailDomain = email.split('@')[1]?.toLowerCase();
        if (!emailDomain) return false;
        return emailDomain !== organizationDomain && !emailDomain.endsWith(`.${organizationDomain}`);
      });

      // Update only if the flag changed
      if (shouldBeExternal !== event.isExternal) {
        await prisma.calendarEvent.update({
          where: { id: event.id },
          data: { isExternal: shouldBeExternal },
        });
        eventsUpdated++;
      }
    }

    console.log(
      `[Recalculate External Events] Org ${organizationId}: Processed ${events.length} events, updated ${eventsUpdated}`
    );

    return {
      success: true,
      eventsProcessed: events.length,
      eventsUpdated,
    };
  } catch (error) {
    console.error('[Recalculate External Events] Error:', error);
    return {
      success: false,
      eventsProcessed: 0,
      eventsUpdated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

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
