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

    // 7. Build matching lookup maps for auto-linking events to opportunities/accounts
    if (!user.organization?.id) {
      return NextResponse.json(
        { error: 'User must belong to an organization' },
        { status: 400 }
      );
    }

    // Fetch all accounts in the user's organization with websites
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

    // Fetch all contacts with emails (for more precise matching)
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

    // Helper function to extract domain from email
    const extractDomain = (email: string): string | null => {
      const domain = email.split('@')[1]?.toLowerCase();
      return domain || null;
    };

    // 8. Upsert events into database with automatic matching
    let createdCount = 0;
    let updatedCount = 0;
    let matchedByContact = 0;
    let matchedByDomain = 0;
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

        let matchedOpportunityId: string | null = null;
        let matchedAccountId: string | null = null;

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

            matchedByContact++;
            break;
          }

          if (!matchedAccountId && emailToAccountMap.has(email)) {
            matchedAccountId = emailToAccountMap.get(email)!;
            matchedByContact++;
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

              matchedByDomain++;
              break;
            }
          }
        }

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
            // Auto-link to opportunity/account based on matching logic
            opportunityId: matchedOpportunityId,
            accountId: matchedAccountId,
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
            // Auto-link to opportunity/account based on matching logic
            opportunityId: matchedOpportunityId,
            accountId: matchedAccountId,
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

    console.log(
      `[Calendar Sync] Matched ${matchedByContact} by contact, ${matchedByDomain} by domain`
    );

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
