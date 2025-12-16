// scripts/trigger-calendar-sync.ts
// Manually trigger a full calendar sync to backfill missing events

import { PrismaClient } from '@prisma/client';
import { getValidAccessToken } from '../src/lib/integrations/oauth-helpers';
import { google } from 'googleapis';

const prisma = new PrismaClient();

// Extract domain from email
function extractDomain(email: string): string | null {
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}

// Extract domain from URL
function extractDomainFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

async function triggerSync() {
  console.log('[Sync] Starting manual calendar sync...\n');

  try {
    // Get the user with Google OAuth connected
    const oauthToken = await prisma.oAuthToken.findFirst({
      where: { provider: 'google' },
      include: {
        user: {
          include: { organization: true },
        },
      },
    });

    const user = oauthToken?.user;

    if (!user) {
      console.log('❌ No user found');
      return;
    }

    console.log(`✓ User: ${user.email}`);
    console.log(`✓ Organization: ${user.organization?.name || 'Unknown'}`);
    const organizationDomain = user.organization?.domain || '';
    console.log(`✓ Organization domain: ${organizationDomain}\n`);

    // Get valid OAuth token
    const accessToken = await getValidAccessToken(user.id, 'google');
    console.log('✓ Got valid access token\n');

    // Initialize Google Calendar API client
    const calendar = google.calendar({
      version: 'v3',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Fetch events based on the sync state time range
    // Get sync state to use configured time range
    const syncState = await prisma.calendarSyncState.findFirst({
      where: { userId: user.id, provider: 'google' }
    });
    const startDate = syncState?.timeMin || new Date('2025-01-01T00:00:00Z');
    const endDate = syncState?.timeMax || new Date('2026-03-31T23:59:59Z');

    console.log(`Fetching events from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...\n`);

    // Get all accounts with their websites for domain matching
    const accounts = await prisma.account.findMany({
      where: { organizationId: user.organizationId },
      include: {
        opportunities: {
          select: { id: true, name: true },
        },
      },
    });

    // Build domain to accounts map
    const domainToAccountsMap = new Map<
      string,
      Array<{ id: string; opportunities: Array<{ id: string; name: string }> }>
    >();

    for (const account of accounts) {
      if (account.website) {
        const domain = extractDomainFromUrl(account.website);
        if (domain) {
          if (!domainToAccountsMap.has(domain)) {
            domainToAccountsMap.set(domain, []);
          }
          domainToAccountsMap.get(domain)!.push({
            id: account.id,
            opportunities: account.opportunities,
          });
        }
      }
    }

    console.log(`Built domain map with ${domainToAccountsMap.size} domains\n`);

    // Fetch all events with pagination
    let allEvents: Array<{
      id: string;
      summary: string;
      startTime: Date;
      endTime: Date;
      attendees: string[];
      isExternal: boolean;
      organizerEmail: string | null;
      description: string | null;
      location: string | null;
      meetingUrl: string | null;
    }> = [];
    let pageToken: string | undefined;

    do {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken,
      });

      const events = response.data.items || [];
      console.log(`Fetched ${events.length} events (page token: ${pageToken ? 'yes' : 'initial'})`);

      for (const event of events) {
        const startDateTime = event.start?.dateTime || event.start?.date;
        const endDateTime = event.end?.dateTime || event.end?.date;

        if (!event.id || !startDateTime || !endDateTime) continue;

        const attendeeEmails =
          event.attendees?.map((a) => a.email).filter((e): e is string => !!e) || [];

        // Determine if external
        const orgDomain = organizationDomain.toLowerCase().replace(/^www\./, '');
        const otherAttendees = attendeeEmails.filter(
          (email) => email.toLowerCase() !== user.email?.toLowerCase()
        );
        const externalAttendees = otherAttendees.filter((email) => {
          const emailDomain = email.split('@')[1]?.toLowerCase();
          return emailDomain && emailDomain !== orgDomain && !emailDomain.endsWith(`.${orgDomain}`);
        });
        const isExternal = externalAttendees.length > 0;

        const meetingUrl =
          event.hangoutLink ||
          event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri ||
          null;

        allEvents.push({
          id: event.id,
          summary: event.summary || '(No title)',
          startTime: new Date(startDateTime),
          endTime: new Date(endDateTime),
          attendees: attendeeEmails,
          isExternal,
          organizerEmail: event.organizer?.email || null,
          description: event.description || null,
          location: event.location || null,
          meetingUrl,
        });
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    console.log(`\n✓ Total events fetched: ${allEvents.length}\n`);

    // Upsert events to database
    let createdCount = 0;
    let updatedCount = 0;
    let matchedCount = 0;

    for (const event of allEvents) {
      // Try to match to an opportunity/account
      let matchedOpportunityId: string | null = null;
      let matchedAccountId: string | null = null;

      // Match by attendee email domain → account website domain
      for (const attendeeEmail of event.attendees) {
        const domain = extractDomain(attendeeEmail);
        if (!domain) continue;

        if (domainToAccountsMap.has(domain)) {
          const matchedAccounts = domainToAccountsMap.get(domain)!;
          const firstAccount = matchedAccounts[0];
          matchedAccountId = firstAccount.id;

          // If the account has exactly one opportunity, link to it
          if (firstAccount.opportunities.length === 1) {
            matchedOpportunityId = firstAccount.opportunities[0].id;
          }
          break;
        }
      }

      if (matchedOpportunityId || matchedAccountId) {
        matchedCount++;
      }

      // Upsert the event
      const existing = await prisma.calendarEvent.findFirst({
        where: {
          googleEventId: event.id,
          userId: user.id,
        },
      });

      if (existing) {
        await prisma.calendarEvent.update({
          where: { id: existing.id },
          data: {
            summary: event.summary,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            attendees: event.attendees,
            isExternal: event.isExternal,
            organizerEmail: event.organizerEmail,
            meetingUrl: event.meetingUrl,
            opportunityId: matchedOpportunityId || existing.opportunityId,
            accountId: matchedAccountId || existing.accountId,
          },
        });
        updatedCount++;
      } else {
        await prisma.calendarEvent.create({
          data: {
            googleEventId: event.id,
            userId: user.id,
            summary: event.summary,
            description: event.description,
            location: event.location,
            startTime: event.startTime,
            endTime: event.endTime,
            attendees: event.attendees,
            isExternal: event.isExternal,
            organizerEmail: event.organizerEmail,
            meetingUrl: event.meetingUrl,
            opportunityId: matchedOpportunityId,
            accountId: matchedAccountId,
          },
        });
        createdCount++;
      }
    }

    console.log('\n--- Sync Summary ---');
    console.log(`  Created: ${createdCount}`);
    console.log(`  Updated: ${updatedCount}`);
    console.log(`  Matched to Opp/Account: ${matchedCount}`);
    console.log(`  Total: ${allEvents.length}`);

    // Update sync state
    await prisma.calendarSyncState.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google',
        },
      },
      update: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        timeMin: startDate,
        timeMax: endDate,
      },
      create: {
        userId: user.id,
        provider: 'google',
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        timeMin: startDate,
        timeMax: endDate,
      },
    });

    console.log('\n✓ Sync complete!');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

triggerSync();