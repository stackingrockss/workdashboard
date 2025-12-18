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
import { GoogleTasksClient } from "@/lib/integrations/google-tasks";
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
 * Common TLDs that have two-part extensions (e.g., .co.uk, .com.au)
 * Used to correctly extract base domains
 */
const TWO_PART_TLDS = new Set([
  'co.uk', 'com.au', 'co.nz', 'co.za', 'com.br', 'co.jp', 'co.kr',
  'com.mx', 'com.cn', 'com.sg', 'com.hk', 'co.in', 'com.ar', 'com.tw',
  'org.uk', 'net.au', 'org.au', 'ac.uk', 'gov.uk', 'edu.au',
]);

/**
 * Extracts the base domain from a full domain, handling subdomains correctly.
 *
 * Examples:
 * - usa.twinhealth.com → twinhealth.com
 * - www.example.co.uk → example.co.uk
 * - twinhealth.com → twinhealth.com
 * - mail.subdomain.company.com → company.com
 *
 * @param domain - Full domain (without protocol), e.g., "usa.twinhealth.com"
 * @returns Base domain, e.g., "twinhealth.com"
 */
function extractBaseDomain(domain: string): string {
  const parts = domain.toLowerCase().split('.');

  if (parts.length <= 2) {
    return domain.toLowerCase();
  }

  // Check for two-part TLDs (e.g., co.uk, com.au)
  const lastTwo = parts.slice(-2).join('.');
  if (TWO_PART_TLDS.has(lastTwo)) {
    // Return last 3 parts (e.g., example.co.uk)
    return parts.slice(-3).join('.');
  }

  // Standard TLD: return last 2 parts (e.g., twinhealth.com)
  return parts.slice(-2).join('.');
}

/**
 * Helper: Perform auto-matching of event to opportunity/account
 */
async function matchEventToOpportunityAndAccount(
  event: CalendarEventData,
  emailToOpportunityMap: Map<string, string>,
  emailToAccountMap: Map<string, string>,
  domainToAccountsMap: Map<string, Array<{ id: string; name: string; opportunities: Array<{ id: string; name: string; domain: string | null }> }>>,
  domainToOpportunityMap: Map<string, { id: string; name: string; accountId: string | null }>
): Promise<{ opportunityId: string | null; accountId: string | null; matchedBy: 'contact' | 'domain' | 'opportunity_domain' | null }> {
  let matchedOpportunityId: string | null = null;
  let matchedAccountId: string | null = null;
  let matchedBy: 'contact' | 'domain' | 'opportunity_domain' | null = null;

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

  // Strategy 2: Match by attendee email domain → opportunity domain (direct match)
  // This is the highest priority domain match - opportunity.domain field
  if (!matchedOpportunityId) {
    for (const attendeeEmail of event.attendees) {
      const domain = extractDomain(attendeeEmail);
      if (!domain) continue;

      const baseDomain = extractBaseDomain(domain);
      const domainsToTry = [domain];
      if (baseDomain !== domain) {
        domainsToTry.push(baseDomain);
      }

      for (const domainToMatch of domainsToTry) {
        if (domainToOpportunityMap.has(domainToMatch)) {
          const opp = domainToOpportunityMap.get(domainToMatch)!;
          matchedOpportunityId = opp.id;
          if (opp.accountId) {
            matchedAccountId = opp.accountId;
          }
          matchedBy = 'opportunity_domain';
          break;
        }
      }

      if (matchedOpportunityId) break;
    }
  }

  // Strategy 3: Match by attendee email domain → account website domain
  // Tries exact domain match first, then falls back to base domain matching
  if (!matchedOpportunityId && !matchedAccountId) {
    for (const attendeeEmail of event.attendees) {
      const domain = extractDomain(attendeeEmail);
      if (!domain) continue;

      // Try exact domain match first, then base domain fallback
      // e.g., email @twinhealth.com will match account with usa.twinhealth.com
      const baseDomain = extractBaseDomain(domain);
      const domainsToTry = [domain];
      if (baseDomain !== domain) {
        domainsToTry.push(baseDomain);
      }

      let matchedAccounts: Array<{ id: string; name: string; opportunities: Array<{ id: string; name: string; domain: string | null }> }> | null = null;

      for (const domainToMatch of domainsToTry) {
        if (domainToAccountsMap.has(domainToMatch)) {
          matchedAccounts = domainToAccountsMap.get(domainToMatch)!;
          break;
        }
      }

      if (matchedAccounts) {
        // Prioritize accounts that have opportunities over those that don't
        const accountsWithOpps = matchedAccounts.filter(a => a.opportunities.length > 0);
        const accountToUse = accountsWithOpps.length > 0 ? accountsWithOpps[0] : matchedAccounts[0];

        matchedAccountId = accountToUse.id;

        // If the account has exactly one opportunity, link to it
        if (accountToUse.opportunities.length === 1) {
          matchedOpportunityId = accountToUse.opportunities[0].id;
        }
        // If multiple opportunities, try to match by meeting title
        else if (accountToUse.opportunities.length > 1) {
          const meetingTitle = event.summary.toLowerCase();
          const matchedOpp = accountToUse.opportunities.find(opp =>
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
          domain: true,
        },
      },
    },
  });

  // Fetch all opportunities with domains (for direct domain-to-opportunity matching)
  const opportunitiesWithDomains = await prisma.opportunity.findMany({
    where: {
      organizationId,
      domain: { not: null },
    },
    select: {
      id: true,
      name: true,
      domain: true,
      accountId: true,
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
  const domainToAccountsMap = new Map<string, Array<{ id: string; name: string; opportunities: Array<{ id: string; name: string; domain: string | null }> }>>();
  const domainToOpportunityMap = new Map<string, { id: string; name: string; accountId: string | null }>();

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

  // Map opportunity domains directly to opportunities (highest priority for matching)
  for (const opp of opportunitiesWithDomains) {
    if (opp.domain) {
      const normalizedDomain = opp.domain.toLowerCase().replace(/^www\./, '');
      // Only set if not already mapped (first opportunity wins)
      if (!domainToOpportunityMap.has(normalizedDomain)) {
        domainToOpportunityMap.set(normalizedDomain, {
          id: opp.id,
          name: opp.name,
          accountId: opp.accountId,
        });
      }
    }
  }

  // Map account domains to accounts (both full domain and base domain for subdomain matching)
  for (const account of allAccounts) {
    if (account.website) {
      try {
        const url = new URL(account.website.startsWith('http') ? account.website : `https://${account.website}`);
        const fullDomain = url.hostname.replace(/^www\./, '').toLowerCase();
        const baseDomain = extractBaseDomain(fullDomain);

        // Always add to full domain map
        if (!domainToAccountsMap.has(fullDomain)) {
          domainToAccountsMap.set(fullDomain, []);
        }
        domainToAccountsMap.get(fullDomain)!.push(account);

        // Also add to base domain map if different (for subdomain matching)
        // e.g., usa.twinhealth.com → also index under twinhealth.com
        if (baseDomain !== fullDomain) {
          if (!domainToAccountsMap.has(baseDomain)) {
            domainToAccountsMap.set(baseDomain, []);
          }
          // Only add if not already present (avoid duplicates)
          const existingAccounts = domainToAccountsMap.get(baseDomain)!;
          if (!existingAccounts.some(a => a.id === account.id)) {
            existingAccounts.push(account);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return { emailToOpportunityMap, emailToAccountMap, domainToAccountsMap, domainToOpportunityMap };
}

/**
 * Minimal event data needed for creating follow-up tasks
 */
interface FollowUpEventData {
  id: string;
  calendarEventId: string; // Database ID for updating flag
  opportunityId: string;
  summary: string;
  startTime: Date;
}

/**
 * Helper: Create follow-up task for upcoming external calendar event
 *
 * Behavior:
 * - Only creates task if user has autoCreateMeetingTasks enabled
 * - Task title: "[Company Name] follow up email"
 * - Task due date: Same day as meeting at 9 AM
 * - Deduplicates using taskSource field with event ID
 * - Marks event with followupTaskCreated flag to prevent recreation
 * - Requires user to have Google Tasks connected
 *
 * @param userId - User ID who owns the calendar event
 * @param event - Calendar event data (must include opportunityId)
 * @throws Will not throw - logs errors and returns gracefully
 */
async function createFollowUpTaskForEvent(
  userId: string,
  event: FollowUpEventData
): Promise<void> {
  // 1. Check user preference
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { autoCreateMeetingTasks: true },
  });

  if (!user?.autoCreateMeetingTasks) {
    return; // User has disabled automation
  }

  // 2. Fetch opportunity and account for task title
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: event.opportunityId },
    select: {
      id: true,
      name: true,
      account: {
        select: { id: true, name: true },
      },
    },
  });

  if (!opportunity?.account) {
    console.warn(`[Calendar Sync] No account found for opportunity ${event.opportunityId}`);
    return;
  }

  const companyName = opportunity.account.name;

  // 3. Early duplicate check (BEFORE Google API call to avoid duplicate API calls)
  const taskSource = `calendar-followup:${event.id}`;
  const existingTask = await prisma.task.findFirst({
    where: {
      userId,
      taskSource, // Check by event ID to prevent duplicates for the same event
    },
  });

  if (existingTask) {
    console.log(`[Calendar Sync] Follow-up task already exists for event ${event.id}`);
    return;
  }

  // 4. Get user's primary task list
  let taskList = await prisma.taskList.findFirst({
    where: {
      userId,
      title: 'My Tasks',
    },
  });

  if (!taskList) {
    // Fallback: use first task list
    taskList = await prisma.taskList.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!taskList) {
    console.warn(`[Calendar Sync] User ${userId} has no Google Task lists`);
    return;
  }

  // 5. Calculate due date (same day as meeting)
  const dueDate = new Date(event.startTime);
  dueDate.setHours(9, 0, 0, 0); // 9 AM on meeting day

  // 6. Check if user has valid Google Tasks OAuth token
  try {
    await getValidAccessToken(userId, 'google');
  } catch (error) {
    console.warn(`[Calendar Sync] User ${userId} does not have valid Google OAuth token, skipping task creation`);
    return; // Skip task creation gracefully
  }

  // 7. Create task via Google Tasks API
  const googleTasksClient = new GoogleTasksClient();
  let createdTask;

  try {
    createdTask = await googleTasksClient.createTask(userId, taskList.googleListId, {
      title: `${companyName} follow up email`,
      notes: `Follow up on meeting scheduled for ${event.startTime.toLocaleDateString()}.\n\nCalendar event: ${event.summary}`,
      due: dueDate,
    });
  } catch (error) {
    console.error(`[Calendar Sync] Failed to create Google task:`, error);
    return;
  }

  // 8. Store in database with UPSERT (handles race conditions)
  try {
    await prisma.task.upsert({
      where: {
        userId_googleTaskId: {
          userId,
          googleTaskId: createdTask.id,
        },
      },
      update: {
        // Update if somehow created between our check and now
        title: createdTask.title,
        notes: createdTask.notes,
        due: createdTask.due,
        position: createdTask.position,
        taskSource,
        updatedAt: new Date(),
      },
      create: {
        userId,
        taskListId: taskList.id,
        googleTaskId: createdTask.id,
        title: createdTask.title,
        notes: createdTask.notes,
        due: createdTask.due,
        status: 'needsAction',
        position: createdTask.position,
        opportunityId: event.opportunityId,
        accountId: opportunity.account.id,
        taskSource, // REQUIRED for uniqueness constraint
      },
    });

    // 9. Mark event as having task created (prevents recreation)
    await prisma.calendarEvent.update({
      where: { id: event.calendarEventId },
      data: { followupTaskCreated: true },
    });

    console.log(`[Calendar Sync] Created follow-up task: "${companyName} follow up email" for user ${userId}`);
  } catch (error: unknown) {
    // Handle unique constraint violation on taskSource
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      console.log(`[Calendar Sync] Task already exists (race condition handled): ${event.id}`);

      // Still mark flag even if task exists (prevents future recreation attempts)
      await prisma.calendarEvent.update({
        where: { id: event.calendarEventId },
        data: { followupTaskCreated: true },
      });

      return;
    }
    throw error; // Re-throw other errors
  }
}

/**
 * Helper: Create prep task for upcoming external calendar event
 *
 * Behavior:
 * - Only creates task if user has autoCreateMeetingTasks enabled
 * - Task title: "Prepare for [Company Name] meeting"
 * - Task due date: 1 day before meeting at 9 AM
 * - Deduplicates using taskSource field with event ID
 * - Marks event with prepTaskCreated flag to prevent recreation
 * - Requires user to have Google Tasks connected
 * - Skips same-day meetings (prep task would be past due)
 *
 * @param userId - User ID who owns the calendar event
 * @param event - Calendar event data (must include opportunityId)
 * @throws Will not throw - logs errors and returns gracefully
 */
async function createPrepTaskForEvent(
  userId: string,
  event: FollowUpEventData
): Promise<void> {
  // 1. Check user preference
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { autoCreateMeetingTasks: true },
  });

  if (!user?.autoCreateMeetingTasks) {
    return; // User has disabled automation
  }

  // 2. Fetch opportunity and account for task title
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: event.opportunityId },
    select: {
      id: true,
      name: true,
      account: {
        select: { id: true, name: true },
      },
    },
  });

  if (!opportunity?.account) {
    console.warn(`[Calendar Sync] No account found for opportunity ${event.opportunityId}`);
    return;
  }

  const companyName = opportunity.account.name;

  // 3. Early duplicate check (BEFORE Google API call to avoid duplicate API calls)
  const taskSource = `calendar-prep:${event.id}`;
  const existingTask = await prisma.task.findFirst({
    where: {
      userId,
      taskSource,
    },
  });

  if (existingTask) {
    console.log(`[Calendar Sync] Prep task already exists for event ${event.id}`);
    return;
  }

  // 4. Get user's primary task list
  let taskList = await prisma.taskList.findFirst({
    where: {
      userId,
      title: 'My Tasks',
    },
  });

  if (!taskList) {
    taskList = await prisma.taskList.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!taskList) {
    console.warn(`[Calendar Sync] User ${userId} has no Google Task lists`);
    return;
  }

  // 5. Calculate due date (1 day before meeting at 9 AM)
  const dueDate = new Date(event.startTime);
  dueDate.setDate(dueDate.getDate() - 1);
  dueDate.setHours(9, 0, 0, 0);

  // 6. Check if user has valid Google Tasks OAuth token
  try {
    await getValidAccessToken(userId, 'google');
  } catch (error) {
    console.warn(`[Calendar Sync] User ${userId} does not have valid Google OAuth token, skipping prep task creation`);
    return;
  }

  // 7. Create task via Google Tasks API
  const googleTasksClient = new GoogleTasksClient();
  let createdTask;

  try {
    createdTask = await googleTasksClient.createTask(userId, taskList.googleListId, {
      title: `Prepare for ${companyName} meeting`,
      notes: `Prepare for meeting with ${companyName} on ${event.startTime.toLocaleDateString()}.\n\nCalendar event: ${event.summary}`,
      due: dueDate,
    });
  } catch (error) {
    console.error(`[Calendar Sync] Failed to create Google prep task:`, error);
    return;
  }

  // 8. Store in database with UPSERT (handles race conditions)
  try {
    await prisma.task.upsert({
      where: {
        userId_googleTaskId: {
          userId,
          googleTaskId: createdTask.id,
        },
      },
      update: {
        title: createdTask.title,
        notes: createdTask.notes,
        due: createdTask.due,
        position: createdTask.position,
        taskSource,
        updatedAt: new Date(),
      },
      create: {
        userId,
        taskListId: taskList.id,
        googleTaskId: createdTask.id,
        title: createdTask.title,
        notes: createdTask.notes,
        due: createdTask.due,
        status: 'needsAction',
        position: createdTask.position,
        opportunityId: event.opportunityId,
        accountId: opportunity.account.id,
        taskSource,
      },
    });

    // 9. Mark event as having prep task created (prevents recreation)
    await prisma.calendarEvent.update({
      where: { id: event.calendarEventId },
      data: { prepTaskCreated: true },
    });

    console.log(`[Calendar Sync] Created prep task: "Prepare for ${companyName} meeting" for user ${userId}`);
  } catch (error: unknown) {
    // Handle unique constraint violation on taskSource
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      console.log(`[Calendar Sync] Prep task already exists (race condition handled): ${event.id}`);

      await prisma.calendarEvent.update({
        where: { id: event.calendarEventId },
        data: { prepTaskCreated: true },
      });

      return;
    }
    throw error;
  }
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
  const { emailToOpportunityMap, emailToAccountMap, domainToAccountsMap, domainToOpportunityMap } =
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
        domainToAccountsMap,
        domainToOpportunityMap
      );

      if (matchedBy === 'contact') matchedByContact++;
      if (matchedBy === 'domain' || matchedBy === 'opportunity_domain') matchedByDomain++;

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
          source: 'google',
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
          source: 'google',
        },
      });
      upsertedCount++;
    } catch (error) {
      console.error(`[Calendar Sync] Failed to process event ${event.id} for user ${userId}:`, error);
      // Continue to next event instead of failing entire sync
    }
  }

  // Create follow-up tasks for upcoming external events linked to opportunities
  // Query database for future events that haven't had tasks created yet
  const upcomingEvents = await prisma.calendarEvent.findMany({
    where: {
      userId,
      isExternal: true,
      opportunityId: { not: null },
      startTime: { gt: new Date() }, // Future events only
      followupTaskCreated: { not: true }, // Task not yet created
    },
    select: {
      id: true,
      googleEventId: true,
      summary: true,
      startTime: true,
      opportunityId: true,
    },
  });

  for (const event of upcomingEvents) {
    if (!event.opportunityId) continue; // TypeScript guard

    try {
      // Create follow-up task using the DB event data
      await createFollowUpTaskForEvent(userId, {
        id: event.googleEventId || event.id,
        calendarEventId: event.id,
        opportunityId: event.opportunityId,
        summary: event.summary,
        startTime: event.startTime,
      });
    } catch (error) {
      // Log error but don't break calendar sync
      console.error(`[Calendar Sync] Failed to create follow-up task for event ${event.id}:`, error);
      // Continue to next event
    }
  }

  // Create prep tasks for upcoming external events (must be at least 1 day away)
  // Skip same-day meetings since prep task would be past due
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const eventsNeedingPrep = await prisma.calendarEvent.findMany({
    where: {
      userId,
      isExternal: true,
      opportunityId: { not: null },
      startTime: { gte: tomorrow }, // Meeting must be tomorrow or later
      prepTaskCreated: { not: true }, // Prep task not yet created
    },
    select: {
      id: true,
      googleEventId: true,
      summary: true,
      startTime: true,
      opportunityId: true,
    },
  });

  for (const event of eventsNeedingPrep) {
    if (!event.opportunityId) continue; // TypeScript guard

    try {
      await createPrepTaskForEvent(userId, {
        id: event.googleEventId || event.id,
        calendarEventId: event.id,
        opportunityId: event.opportunityId,
        summary: event.summary,
        startTime: event.startTime,
      });
    } catch (error) {
      console.error(`[Calendar Sync] Failed to create prep task for event ${event.id}:`, error);
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
  { cron: "0 * * * *" }, // Every hour (reduced from 15min to save compute)
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
