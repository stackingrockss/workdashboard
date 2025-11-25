// src/lib/inngest/functions/sync-calendar-events.ts
// Inngest background job for syncing Google Calendar events to database
// Uses incremental sync with sync tokens for efficiency

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import {
  googleCalendarClient,
  SyncTokenInvalidError,
  type CalendarEventData,
} from "@/lib/integrations/google-calendar";
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
 * Helper: Perform auto-matching of event to opportunity/account
 */
async function matchEventToOpportunityAndAccount(
  event: CalendarEventData,
  emailToOpportunityMap: Map<string, string>,
  emailToAccountMap: Map<string, string>,
  domainToAccountsMap: Map<string, Array<{ id: string; name: string; opportunities: Array<{ id: string; name: string }> }>>
): Promise<{ opportunityId: string | null; accountId: string | null; matchedBy: 'contact' | 'domain' | null }> {
  let matchedOpportunityId: string | null = null;
  let matchedAccountId: string | null = null;
  let matchedBy: 'contact' | 'domain' | null = null;

  // Helper function to extract domain from email
  const extractDomain = (email: string): string | null => {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain || null;
  };

  // Strategy 1: Match by contact email (most specific)
  for (const attendeeEmail of event.attendees) {
    const email = attendeeEmail.toLowerCase();

    if (emailToOpportunityMap.has(email)) {
      matchedOpportunityId = emailToOpportunityMap.get(email)!;

      // Get the account from the opportunity
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: matchedOpportunityId },
        select: { accountId: true },
      });
      if (opportunity?.accountId) {
        matchedAccountId = opportunity.accountId;
      }

      matchedBy = 'contact';
      break;
    }

    if (!matchedAccountId && emailToAccountMap.has(email)) {
      matchedAccountId = emailToAccountMap.get(email)!;
      matchedBy = 'contact';
    }
  }

  // Strategy 2: Match by attendee email domain → account website domain
  if (!matchedOpportunityId && !matchedAccountId) {
    for (const attendeeEmail of event.attendees) {
      const domain = extractDomain(attendeeEmail);
      if (!domain) continue;

      if (domainToAccountsMap.has(domain)) {
        const matchedAccounts = domainToAccountsMap.get(domain)!;

        // Use the first matched account
        const firstAccount = matchedAccounts[0];
        matchedAccountId = firstAccount.id;

        // If the account has exactly one opportunity, link to it
        if (firstAccount.opportunities.length === 1) {
          matchedOpportunityId = firstAccount.opportunities[0].id;
        }
        // If multiple opportunities, try to match by meeting title
        else if (firstAccount.opportunities.length > 1) {
          const meetingTitle = event.summary.toLowerCase();
          const matchedOpp = firstAccount.opportunities.find(opp =>
            meetingTitle.includes(opp.name.toLowerCase()) ||
            opp.name.toLowerCase().includes(meetingTitle)
          );
          if (matchedOpp) {
            matchedOpportunityId = matchedOpp.id;
          }
        }

        matchedBy = 'domain';
        break;
      }
    }
  }

  return { opportunityId: matchedOpportunityId, accountId: matchedAccountId, matchedBy };
}

/**
 * Helper: Build lookup maps for opportunity/account matching
 */
async function buildMatchingMaps(organizationId: string) {
  // Fetch all accounts in the user's organization with websites
  const allAccounts = await prisma.account.findMany({
    where: {
      organizationId,
      website: { not: null },
    },
    select: {
      id: true,
      name: true,
      website: true,
      opportunities: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Fetch all contacts with emails (for more precise matching)
  const allContacts = await prisma.contact.findMany({
    where: {
      opportunity: {
        organizationId,
      },
      email: { not: null },
    },
    select: {
      email: true,
      opportunityId: true,
      accountId: true,
    },
  });

  // Build lookup maps
  const emailToOpportunityMap = new Map<string, string>();
  const emailToAccountMap = new Map<string, string>();
  const domainToAccountsMap = new Map<string, Array<{ id: string; name: string; opportunities: Array<{ id: string; name: string }> }>>();

  // Map contact emails to opportunities/accounts
  for (const contact of allContacts) {
    if (contact.email) {
      const email = contact.email.toLowerCase();
      if (contact.opportunityId) {
        emailToOpportunityMap.set(email, contact.opportunityId);
      }
      if (contact.accountId) {
        emailToAccountMap.set(email, contact.accountId);
      }
    }
  }

  // Map account domains to accounts
  for (const account of allAccounts) {
    if (account.website) {
      try {
        const url = new URL(account.website.startsWith('http') ? account.website : `https://${account.website}`);
        const domain = url.hostname.replace(/^www\./, '').toLowerCase();

        if (!domainToAccountsMap.has(domain)) {
          domainToAccountsMap.set(domain, []);
        }
        domainToAccountsMap.get(domain)!.push(account);
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return { emailToOpportunityMap, emailToAccountMap, domainToAccountsMap };
}

/**
 * Sync calendar events for a single user using incremental sync
 */
async function syncUserCalendar(userId: string): Promise<{
  success: boolean;
  eventsProcessed: number;
  eventsDeleted: number;
  isIncremental: boolean;
  error?: string;
}> {
  // Get or create sync state for this user
  let syncState = await prisma.calendarSyncState.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'google',
      },
    },
  });

  // Calculate default date range: 90 days past to 90 days future
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 90);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 90);

  // Create sync state if it doesn't exist
  if (!syncState) {
    syncState = await prisma.calendarSyncState.create({
      data: {
        userId,
        provider: 'google',
        syncToken: null,
        timeMin: startDate,
        timeMax: endDate,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      },
    });
  }

  const isIncremental = !!syncState.syncToken;

  // Fetch events using incremental sync (or full sync if no token)
  let allEvents: CalendarEventData[] = [];
  let pageToken: string | undefined = undefined;
  let nextSyncToken: string | undefined = undefined;
  let pageCount = 0;
  const maxPages = 50; // Increased limit for incremental sync (usually much smaller result sets)

  try {
    do {
      const response = await googleCalendarClient.listEventsIncremental(userId, {
        // For full sync, use date range
        startDate: isIncremental ? undefined : startDate,
        endDate: isIncremental ? undefined : endDate,
        // For incremental sync, use sync token
        syncToken: syncState.syncToken || undefined,
        pageToken,
        maxResults: 100, // Increased since incremental returns fewer events
        showDeleted: true, // Required for incremental sync to detect deletions
      });

      allEvents = allEvents.concat(response.events);
      pageToken = response.nextPageToken;
      nextSyncToken = response.nextSyncToken; // Will be set on the last page
      pageCount++;
    } while (pageToken && pageCount < maxPages);
  } catch (error) {
    if (error instanceof SyncTokenInvalidError) {
      // Sync token was invalidated (410 error), clear it and retry with full sync
      console.log(`[Calendar Sync] User ${userId}: Sync token invalidated, performing full sync`);
      await prisma.calendarSyncState.update({
        where: { userId_provider: { userId, provider: 'google' } },
        data: {
          syncToken: null,
          lastSyncStatus: 'token_invalidated',
          lastSyncError: 'Sync token was invalidated by Google, performed full sync',
        },
      });

      // Retry with full sync
      return syncUserCalendar(userId);
    }
    throw error;
  }

  // Get user's organization for matching
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    console.warn(`User ${userId}: No organization found, skipping matching`);
    return {
      success: true,
      eventsProcessed: 0,
      eventsDeleted: 0,
      isIncremental,
    };
  }

  // Build matching maps
  const { emailToOpportunityMap, emailToAccountMap, domainToAccountsMap } =
    await buildMatchingMaps(user.organizationId);

  // Process events
  let upsertedCount = 0;
  let deletedCount = 0;
  let matchedByContact = 0;
  let matchedByDomain = 0;

  for (const event of allEvents) {
    try {
      // Handle deleted events (status='cancelled')
      if (event.status === 'cancelled') {
        const deleteResult = await prisma.calendarEvent.deleteMany({
          where: {
            userId,
            googleEventId: event.id,
          },
        });
        if (deleteResult.count > 0) {
          deletedCount++;
          console.log(`[Calendar Sync] User ${userId}: Deleted event ${event.id}`);
        }
        continue;
      }

      // Skip internal events (only store external events)
      if (!event.isExternal) {
        // If this event exists in DB and is now internal, delete it
        const existingEvent = await prisma.calendarEvent.findUnique({
          where: {
            userId_googleEventId: {
              userId,
              googleEventId: event.id,
            },
          },
        });
        if (existingEvent) {
          await prisma.calendarEvent.delete({
            where: { id: existingEvent.id },
          });
          deletedCount++;
          console.log(`[Calendar Sync] User ${userId}: Removed now-internal event ${event.id}`);
        }
        continue;
      }

      // Match event to opportunity/account
      const { opportunityId, accountId, matchedBy } = await matchEventToOpportunityAndAccount(
        event,
        emailToOpportunityMap,
        emailToAccountMap,
        domainToAccountsMap
      );

      if (matchedBy === 'contact') matchedByContact++;
      if (matchedBy === 'domain') matchedByDomain++;

      // Upsert external event
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
          opportunityId,
          accountId,
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
          opportunityId,
          accountId,
        },
      });
      upsertedCount++;
    } catch (error) {
      console.error(`[Calendar Sync] Failed to process event ${event.id} for user ${userId}:`, error);
      // Continue to next event instead of failing entire sync
    }
  }

  // Update sync state with new token
  await prisma.calendarSyncState.update({
    where: { userId_provider: { userId, provider: 'google' } },
    data: {
      syncToken: nextSyncToken || syncState.syncToken, // Keep old token if no new one
      timeMin: startDate,
      timeMax: endDate,
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
      lastSyncError: null,
    },
  });

  console.log(
    `[Calendar Sync] User ${userId}: ${isIncremental ? 'Incremental' : 'Full'} sync complete. ` +
    `Processed: ${upsertedCount}, Deleted: ${deletedCount}, ` +
    `Matched by contact: ${matchedByContact}, by domain: ${matchedByDomain}`
  );

  return {
    success: true,
    eventsProcessed: upsertedCount,
    eventsDeleted: deletedCount,
    isIncremental,
  };
}

/**
 * Background job that syncs calendar events for all users with connected Google Calendars
 * Uses incremental sync with sync tokens for efficiency
 * Runs every 15 minutes via cron schedule
 * Only stores external events (meetings with external attendees)
 */
export const syncAllCalendarEventsJob = inngest.createFunction(
  {
    id: "sync-all-calendar-events",
    name: "Sync All Calendar Events (Incremental)",
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
        incrementalSyncs: 0,
        fullSyncs: 0,
      };
    }

    let successfulSyncs = 0;
    let failedSyncs = 0;
    let incrementalSyncs = 0;
    let fullSyncs = 0;
    const syncErrors: Array<{ userId: string; error: string }> = [];

    // Step 2: Sync each user sequentially with individual error handling
    for (const userId of usersWithCalendar) {
      await step.run(`sync-user-${userId}`, async () => {
        try {
          // Validate access token (auto-refreshes if expired)
          try {
            await getValidAccessToken(userId, "google");
          } catch {
            // Token expired or revoked, skip this user
            console.warn(`[Calendar Sync] User ${userId}: Calendar not connected or token invalid`);
            failedSyncs++;
            syncErrors.push({
              userId,
              error: "Token invalid or expired",
            });

            // Update sync state to reflect error
            await prisma.calendarSyncState.upsert({
              where: { userId_provider: { userId, provider: 'google' } },
              update: {
                lastSyncStatus: 'failed',
                lastSyncError: 'Token invalid or expired',
              },
              create: {
                userId,
                provider: 'google',
                syncToken: null,
                timeMin: new Date(),
                timeMax: new Date(),
                lastSyncStatus: 'failed',
                lastSyncError: 'Token invalid or expired',
              },
            });

            return { skipped: true, reason: "Token invalid" };
          }

          // Perform sync
          const result = await syncUserCalendar(userId);

          if (result.success) {
            successfulSyncs++;
            if (result.isIncremental) {
              incrementalSyncs++;
            } else {
              fullSyncs++;
            }
          } else {
            failedSyncs++;
            if (result.error) {
              syncErrors.push({ userId, error: result.error });
            }
          }

          return result;
        } catch (error) {
          console.error(`[Calendar Sync] Failed to sync calendar for user ${userId}:`, error);
          failedSyncs++;
          syncErrors.push({
            userId,
            error: error instanceof Error ? error.message : String(error),
          });

          // Update sync state to reflect error
          await prisma.calendarSyncState.upsert({
            where: { userId_provider: { userId, provider: 'google' } },
            update: {
              lastSyncStatus: 'failed',
              lastSyncError: error instanceof Error ? error.message : String(error),
            },
            create: {
              userId,
              provider: 'google',
              syncToken: null,
              timeMin: new Date(),
              timeMax: new Date(),
              lastSyncStatus: 'failed',
              lastSyncError: error instanceof Error ? error.message : String(error),
            },
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
      incrementalSyncs,
      fullSyncs,
      syncErrors: syncErrors.length > 0 ? syncErrors : undefined,
    };
  }
);
