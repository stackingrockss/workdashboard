// src/app/api/v1/integrations/google/calendar/sync/route.ts
// Manual trigger API for syncing calendar events immediately
// Uses incremental sync with sync tokens and only stores external events

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  googleCalendarClient,
  SyncTokenInvalidError,
  type CalendarEventData,
} from '@/lib/integrations/google-calendar';
import { getValidAccessToken } from '@/lib/integrations/oauth-helpers';
import { requireAuth } from '@/lib/auth';

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

  const extractDomain = (email: string): string | null => {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain || null;
  };

  // Strategy 1: Match by contact email (most specific)
  for (const attendeeEmail of event.attendees) {
    const email = attendeeEmail.toLowerCase();

    if (emailToOpportunityMap.has(email)) {
      matchedOpportunityId = emailToOpportunityMap.get(email)!;

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
        const firstAccount = matchedAccounts[0];
        matchedAccountId = firstAccount.id;

        if (firstAccount.opportunities.length === 1) {
          matchedOpportunityId = firstAccount.opportunities[0].id;
        } else if (firstAccount.opportunities.length > 1) {
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
 * POST /api/v1/integrations/google/calendar/sync
 *
 * Manually triggers a calendar sync for the authenticated user.
 * Uses incremental sync with sync tokens for efficiency.
 * Only stores external events (meetings with external attendees).
 *
 * Query params:
 * - forceFullSync=true: Forces a full sync by clearing the sync token
 *
 * @returns Sync status and statistics
 */
export async function POST(request: Request) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const forceFullSync = searchParams.get('forceFullSync') === 'true';

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

    // 4. Get or create sync state
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 90);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 90);

    let syncState = await prisma.calendarSyncState.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google',
        },
      },
    });

    // Create sync state if it doesn't exist
    if (!syncState) {
      syncState = await prisma.calendarSyncState.create({
        data: {
          userId: user.id,
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

    // Clear sync token if force full sync requested
    if (forceFullSync && syncState.syncToken) {
      await prisma.calendarSyncState.update({
        where: { userId_provider: { userId: user.id, provider: 'google' } },
        data: { syncToken: null },
      });
      syncState.syncToken = null;
      console.log(`[Calendar Sync] User ${user.id}: Force full sync requested`);
    }

    const isIncremental = !!syncState.syncToken;

    console.log(`[Calendar Sync] Starting ${isIncremental ? 'incremental' : 'full'} sync for user ${user.id}`);

    // 5. Fetch events using incremental sync
    let allEvents: CalendarEventData[] = [];
    let pageToken: string | undefined = undefined;
    let nextSyncToken: string | undefined = undefined;
    let pageCount = 0;
    const maxPages = 50;

    try {
      do {
        const response = await googleCalendarClient.listEventsIncremental(user.id, {
          startDate: isIncremental ? undefined : startDate,
          endDate: isIncremental ? undefined : endDate,
          syncToken: syncState.syncToken || undefined,
          pageToken,
          maxResults: 100,
          showDeleted: true,
        });

        allEvents = allEvents.concat(response.events);
        pageToken = response.nextPageToken;
        nextSyncToken = response.nextSyncToken;
        pageCount++;
      } while (pageToken && pageCount < maxPages);
    } catch (error) {
      if (error instanceof SyncTokenInvalidError) {
        // Clear sync token and retry with full sync
        console.log(`[Calendar Sync] User ${user.id}: Sync token invalidated, retrying with full sync`);
        await prisma.calendarSyncState.update({
          where: { userId_provider: { userId: user.id, provider: 'google' } },
          data: { syncToken: null },
        });

        // Retry the request
        do {
          const response = await googleCalendarClient.listEventsIncremental(user.id, {
            startDate,
            endDate,
            pageToken,
            maxResults: 100,
            showDeleted: true,
          });

          allEvents = allEvents.concat(response.events);
          pageToken = response.nextPageToken;
          nextSyncToken = response.nextSyncToken;
          pageCount++;
        } while (pageToken && pageCount < maxPages);
      } else {
        throw error;
      }
    }

    console.log(`[Calendar Sync] Fetched ${allEvents.length} events from Google Calendar`);

    if (allEvents.length === 0 && isIncremental) {
      // Update sync state even if no changes
      await prisma.calendarSyncState.update({
        where: { userId_provider: { userId: user.id, provider: 'google' } },
        data: {
          syncToken: nextSyncToken || syncState.syncToken,
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          lastSyncError: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'No changes since last sync',
        isIncremental: true,
        stats: {
          eventsProcessed: 0,
          eventsCreated: 0,
          eventsUpdated: 0,
          eventsDeleted: 0,
        },
      });
    }

    // 6. Build matching lookup maps
    if (!user.organization?.id) {
      return NextResponse.json(
        { error: 'User must belong to an organization' },
        { status: 400 }
      );
    }

    const allAccounts = await prisma.account.findMany({
      where: {
        organizationId: user.organization.id,
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

    const allContacts = await prisma.contact.findMany({
      where: {
        opportunity: {
          organizationId: user.organization.id,
        },
        email: { not: null },
      },
      select: {
        email: true,
        opportunityId: true,
        accountId: true,
      },
    });

    const emailToOpportunityMap = new Map<string, string>();
    const emailToAccountMap = new Map<string, string>();
    const domainToAccountsMap = new Map<string, Array<{ id: string; name: string; opportunities: Array<{ id: string; name: string }> }>>();

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

    // 7. Process events
    let createdCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    let skippedInternal = 0;
    let matchedByContact = 0;
    let matchedByDomain = 0;
    const errors: string[] = [];

    for (const event of allEvents) {
      try {
        // Handle deleted events
        if (event.status === 'cancelled') {
          const deleteResult = await prisma.calendarEvent.deleteMany({
            where: {
              userId: user.id,
              googleEventId: event.id,
            },
          });
          if (deleteResult.count > 0) {
            deletedCount++;
          }
          continue;
        }

        // Skip internal events (only store external events)
        if (!event.isExternal) {
          // If exists in DB, delete it (it became internal)
          const existingEvent = await prisma.calendarEvent.findUnique({
            where: {
              userId_googleEventId: {
                userId: user.id,
                googleEventId: event.id,
              },
            },
          });
          if (existingEvent) {
            await prisma.calendarEvent.delete({
              where: { id: existingEvent.id },
            });
            deletedCount++;
          }
          skippedInternal++;
          continue;
        }

        // Check if event exists
        const existingEvent = await prisma.calendarEvent.findUnique({
          where: {
            userId_googleEventId: {
              userId: user.id,
              googleEventId: event.id,
            },
          },
        });

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
            opportunityId,
            accountId,
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
            opportunityId,
            accountId,
          },
        });

        if (existingEvent) {
          updatedCount++;
        } else {
          createdCount++;
        }
      } catch (error) {
        console.error(`[Calendar Sync] Failed to process event ${event.id}:`, error);
        errors.push(`Failed to sync event: ${event.summary}`);
      }
    }

    // 8. Update sync state
    await prisma.calendarSyncState.update({
      where: { userId_provider: { userId: user.id, provider: 'google' } },
      data: {
        syncToken: nextSyncToken || syncState.syncToken,
        timeMin: startDate,
        timeMax: endDate,
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
      },
    });

    console.log(
      `[Calendar Sync] Completed: ${createdCount} created, ${updatedCount} updated, ${deletedCount} deleted, ` +
      `${skippedInternal} internal skipped, matched: ${matchedByContact} by contact, ${matchedByDomain} by domain`
    );

    return NextResponse.json({
      success: true,
      message: `Successfully synced calendar`,
      isIncremental,
      stats: {
        eventsProcessed: allEvents.length,
        eventsCreated: createdCount,
        eventsUpdated: updatedCount,
        eventsDeleted: deletedCount,
        internalEventsSkipped: skippedInternal,
        matchedByContact,
        matchedByDomain,
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
