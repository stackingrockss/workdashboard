import { google } from 'googleapis';
import { getValidAccessToken } from './oauth-helpers';
import { prisma } from '@/lib/db';

export interface CalendarEventData {
  id: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  isExternal: boolean;
  organizerEmail?: string | null;
  meetingUrl?: string | null;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

// Custom error class for sync token invalidation (HTTP 410)
export class SyncTokenInvalidError extends Error {
  constructor(message: string = 'Sync token has been invalidated') {
    super(message);
    this.name = 'SyncTokenInvalidError';
  }
}

export interface CreateCalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

export interface UpdateCalendarEventInput {
  summary?: string;
  description?: string;
  location?: string;
  startTime?: Date;
  endTime?: Date;
  attendees?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

export class GoogleCalendarClient {
  /**
   * Creates an authenticated Google Calendar client for a user
   */
  private async getClient(userId: string) {
    const accessToken = await getValidAccessToken(userId, 'google');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Lists calendar events for a user within date range
   */
  async listEvents(
    userId: string,
    startDate: Date,
    endDate: Date,
    options?: {
      accountId?: string;
      opportunityId?: string;
      externalOnly?: boolean;
      pageToken?: string;
      maxResults?: number;
    }
  ): Promise<{
    events: CalendarEventData[];
    nextPageToken?: string;
  }> {
    try {
      const calendar = await this.getClient(userId);

      // Fetch events from Google Calendar with pagination support
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: options?.maxResults || 50,
        pageToken: options?.pageToken,
      });

      if (!response.data.items) {
        return {
          events: [],
          nextPageToken: undefined,
        };
      }

      // Get user's organization domain to detect external meetings
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true },
      });

      const organizationDomain = user?.organization?.domain || '';
      const userEmail = user?.email || undefined;

      // Transform Google Calendar events to our format
      const events = response.data.items
        .map((event) => {
          const attendeeEmails =
            event.attendees?.map((a) => a.email).filter(Boolean) || [];

          const isExternal = this.isExternalEvent(
            attendeeEmails as string[],
            organizationDomain,
            userEmail,
            event.summary ?? undefined
          );

          // Extract meeting URL from various sources
          const meetingUrl =
            event.hangoutLink ||
            event.conferenceData?.entryPoints?.find(
              (ep) => ep.entryPointType === 'video'
            )?.uri ||
            null;

          const startDateTime = event.start?.dateTime || event.start?.date;
          const endDateTime = event.end?.dateTime || event.end?.date;

          if (!event.id || !startDateTime || !endDateTime) {
            return null;
          }

          return {
            id: event.id,
            summary: event.summary || '(No title)',
            description: event.description || null,
            location: event.location || null,
            startTime: new Date(startDateTime),
            endTime: new Date(endDateTime),
            attendees: attendeeEmails as string[],
            isExternal,
            organizerEmail: event.organizer?.email || null,
            meetingUrl,
          };
        })
        .filter((event): event is NonNullable<typeof event> => event !== null)
        .filter((event) => {
          // Filter by external-only if requested
          if (options?.externalOnly && !event.isExternal) {
            return false;
          }

          return true;
        });

      // Filter by account or opportunity if specified
      if (options?.accountId) {
        const account = await prisma.account.findUnique({
          where: { id: options.accountId },
        });

        if (account?.website) {
          const accountDomain = new URL(account.website).hostname.replace(
            'www.',
            ''
          );
          const filteredEvents = events.filter((event) =>
            event.attendees.some((email) => email.includes(accountDomain))
          );
          return {
            events: filteredEvents,
            nextPageToken: response.data.nextPageToken || undefined,
          };
        }
      }

      if (options?.opportunityId) {
        const contacts = await prisma.contact.findMany({
          where: { opportunityId: options.opportunityId },
          select: { email: true },
        });

        const contactEmails = contacts
          .map((c) => c.email)
          .filter(Boolean) as string[];

        if (contactEmails.length > 0) {
          const filteredEvents = events.filter((event) =>
            event.attendees.some((email) => contactEmails.includes(email))
          );
          return {
            events: filteredEvents,
            nextPageToken: response.data.nextPageToken || undefined,
          };
        }
      }

      return {
        events,
        nextPageToken: response.data.nextPageToken || undefined,
      };
    } catch (error) {
      console.error('Failed to list calendar events:', error);
      throw new Error('Failed to fetch calendar events');
    }
  }

  /**
   * Lists calendar events using incremental sync with sync tokens.
   *
   * This method supports two modes:
   * 1. Full sync (no syncToken): Fetches all events within the date range and returns a syncToken
   * 2. Incremental sync (with syncToken): Fetches only events changed since the last sync
   *
   * IMPORTANT: When using syncToken, timeMin/timeMax are ignored by Google's API.
   * The sync token "remembers" the original query parameters.
   *
   * @throws {SyncTokenInvalidError} When Google returns 410 (sync token expired/invalidated)
   */
  async listEventsIncremental(
    userId: string,
    options: {
      // For full sync (initial sync or after token invalidation)
      startDate?: Date;
      endDate?: Date;
      // For incremental sync
      syncToken?: string;
      // Pagination
      pageToken?: string;
      maxResults?: number;
      // Whether to include deleted events (required for incremental sync to work properly)
      showDeleted?: boolean;
    }
  ): Promise<{
    events: CalendarEventData[];
    nextPageToken?: string;
    nextSyncToken?: string;
  }> {
    try {
      const calendar = await this.getClient(userId);

      // Build the request parameters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestParams: any = {
        calendarId: 'primary',
        singleEvents: true,
        maxResults: options.maxResults || 50,
        // Show deleted events so we can remove them from our database
        showDeleted: options.showDeleted ?? true,
      };

      // Sync token mode: use syncToken, ignore date range
      // Google's sync token inherently "remembers" the original time range
      if (options.syncToken) {
        requestParams.syncToken = options.syncToken;
        console.log(`[Calendar] Incremental sync for user ${userId} with syncToken`);
      } else {
        // Full sync mode: use date range
        if (!options.startDate || !options.endDate) {
          throw new Error('startDate and endDate are required for full sync (when no syncToken provided)');
        }
        requestParams.timeMin = options.startDate.toISOString();
        requestParams.timeMax = options.endDate.toISOString();
        requestParams.orderBy = 'startTime';
        console.log(`[Calendar] Full sync for user ${userId}: ${options.startDate.toISOString()} to ${options.endDate.toISOString()}`);
      }

      // Add pagination token if provided
      if (options.pageToken) {
        requestParams.pageToken = options.pageToken;
      }

      const response = await calendar.events.list(requestParams);

      if (!response.data.items) {
        return {
          events: [],
          nextPageToken: response.data.nextPageToken || undefined,
          nextSyncToken: response.data.nextSyncToken || undefined,
        };
      }

      // Get user's organization domain to detect external meetings
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true },
      });

      const organizationDomain = user?.organization?.domain || '';
      const userEmail = user?.email || undefined;

      // Transform Google Calendar events to our format
      // Note: Deleted events will have status='cancelled' and minimal data
      const events = response.data.items
        .map((event) => {
          // Handle cancelled/deleted events
          if (event.status === 'cancelled') {
            // For deleted events, we only need the ID to remove from our database
            return {
              id: event.id!,
              summary: event.summary || '(Deleted)',
              description: null,
              location: null,
              startTime: new Date(), // Placeholder - not used for deleted events
              endTime: new Date(), // Placeholder - not used for deleted events
              attendees: [],
              isExternal: false,
              organizerEmail: null,
              meetingUrl: null,
              status: 'cancelled' as const,
            };
          }

          const attendeeEmails =
            event.attendees?.map((a) => a.email).filter(Boolean) || [];

          const isExternal = this.isExternalEvent(
            attendeeEmails as string[],
            organizationDomain,
            userEmail,
            event.summary ?? undefined
          );

          // Extract meeting URL from various sources
          const meetingUrl =
            event.hangoutLink ||
            event.conferenceData?.entryPoints?.find(
              (ep) => ep.entryPointType === 'video'
            )?.uri ||
            null;

          const startDateTime = event.start?.dateTime || event.start?.date;
          const endDateTime = event.end?.dateTime || event.end?.date;

          if (!event.id || !startDateTime || !endDateTime) {
            return null;
          }

          return {
            id: event.id,
            summary: event.summary || '(No title)',
            description: event.description || null,
            location: event.location || null,
            startTime: new Date(startDateTime),
            endTime: new Date(endDateTime),
            attendees: attendeeEmails as string[],
            isExternal,
            organizerEmail: event.organizer?.email || null,
            meetingUrl,
            status: (event.status as 'confirmed' | 'tentative' | 'cancelled') || 'confirmed',
          };
        })
        .filter((event): event is NonNullable<typeof event> => event !== null);

      return {
        events,
        nextPageToken: response.data.nextPageToken || undefined,
        nextSyncToken: response.data.nextSyncToken || undefined,
      };
    } catch (error: unknown) {
      // Check for 410 Gone error (sync token invalidated)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: number }).code === 410
      ) {
        console.warn(`[Calendar] Sync token invalidated for user ${userId} - need full sync`);
        throw new SyncTokenInvalidError();
      }

      console.error('Failed to list calendar events (incremental):', error);
      throw new Error('Failed to fetch calendar events');
    }
  }

  /**
   * Gets a single calendar event by ID
   */
  async getEvent(
    userId: string,
    eventId: string
  ): Promise<CalendarEventData | null> {
    try {
      const calendar = await this.getClient(userId);

      const response = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });

      const event = response.data;

      if (!event) {
        return null;
      }

      // Get user's organization domain
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true },
      });

      const organizationDomain = user?.organization?.domain || '';
      const userEmail = user?.email || undefined;

      const attendeeEmails =
        event.attendees?.map((a) => a.email).filter(Boolean) || [];

      const isExternal = this.isExternalEvent(
        attendeeEmails as string[],
        organizationDomain,
        userEmail,
        event.summary ?? undefined
      );

      const meetingUrl =
        event.hangoutLink ||
        event.conferenceData?.entryPoints?.find(
          (ep) => ep.entryPointType === 'video'
        )?.uri ||
        null;

      const startDateTime = event.start?.dateTime || event.start?.date;
      const endDateTime = event.end?.dateTime || event.end?.date;

      if (!event.id || !startDateTime || !endDateTime) {
        throw new Error('Event missing required fields');
      }

      return {
        id: event.id,
        summary: event.summary || '(No title)',
        description: event.description || null,
        location: event.location || null,
        startTime: new Date(startDateTime),
        endTime: new Date(endDateTime),
        attendees: attendeeEmails as string[],
        isExternal,
        organizerEmail: event.organizer?.email || null,
        meetingUrl,
      };
    } catch (error) {
      console.error('Failed to get calendar event:', error);
      return null;
    }
  }

  /**
   * Creates a new calendar event
   */
  async createEvent(
    userId: string,
    eventData: CreateCalendarEventInput
  ): Promise<CalendarEventData> {
    try {
      const calendar = await this.getClient(userId);

      const response = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1, // Enable conference data (Google Meet)
        sendUpdates: eventData.sendUpdates || 'none',
        requestBody: {
          summary: eventData.summary,
          description: eventData.description,
          location: eventData.location,
          start: {
            dateTime: eventData.startTime.toISOString(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: eventData.endTime.toISOString(),
            timeZone: 'UTC',
          },
          attendees: eventData.attendees?.map((email) => ({ email })),
          reminders: eventData.reminders || {
            useDefault: true,
          },
          colorId: eventData.colorId,
          // Auto-create Google Meet link
          conferenceData:
            eventData.attendees && eventData.attendees.length > 0
              ? {
                  createRequest: {
                    requestId: `meet-${Date.now()}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' },
                  },
                }
              : undefined,
        },
      });

      const event = response.data;

      // Get user's organization domain
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true },
      });

      const organizationDomain = user?.organization?.domain || '';
      const userEmail = user?.email || undefined;

      const attendeeEmails =
        event.attendees?.map((a) => a.email).filter(Boolean) || [];

      const isExternal = this.isExternalEvent(
        attendeeEmails as string[],
        organizationDomain,
        userEmail,
        event.summary ?? undefined
      );

      const meetingUrl =
        event.hangoutLink ||
        event.conferenceData?.entryPoints?.find(
          (ep) => ep.entryPointType === 'video'
        )?.uri ||
        null;

      const startDateTime = event.start?.dateTime || event.start?.date;
      const endDateTime = event.end?.dateTime || event.end?.date;

      if (!event.id || !startDateTime || !endDateTime) {
        throw new Error('Event missing required fields');
      }

      return {
        id: event.id,
        summary: event.summary || '(No title)',
        description: event.description || null,
        location: event.location || null,
        startTime: new Date(startDateTime),
        endTime: new Date(endDateTime),
        attendees: attendeeEmails as string[],
        isExternal,
        organizerEmail: event.organizer?.email || null,
        meetingUrl,
      };
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Updates an existing calendar event
   */
  async updateEvent(
    userId: string,
    eventId: string,
    eventData: UpdateCalendarEventInput
  ): Promise<CalendarEventData> {
    try {
      const calendar = await this.getClient(userId);

      // Build the update payload
      const updatePayload: Record<string, unknown> = {};

      if (eventData.summary !== undefined) {
        updatePayload.summary = eventData.summary;
      }
      if (eventData.description !== undefined) {
        updatePayload.description = eventData.description;
      }
      if (eventData.location !== undefined) {
        updatePayload.location = eventData.location;
      }
      if (eventData.startTime !== undefined) {
        updatePayload.start = {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC',
        };
      }
      if (eventData.endTime !== undefined) {
        updatePayload.end = {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC',
        };
      }
      if (eventData.attendees !== undefined) {
        updatePayload.attendees = eventData.attendees.map((email) => ({
          email,
        }));
      }
      if (eventData.reminders !== undefined) {
        updatePayload.reminders = eventData.reminders;
      }
      if (eventData.colorId !== undefined) {
        updatePayload.colorId = eventData.colorId;
      }

      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId,
        sendUpdates: eventData.sendUpdates || 'none',
        requestBody: updatePayload,
      });

      const event = response.data;

      // Get user's organization domain
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: true },
      });

      const organizationDomain = user?.organization?.domain || '';
      const userEmail = user?.email || undefined;

      const attendeeEmails =
        event.attendees?.map((a) => a.email).filter(Boolean) || [];

      const isExternal = this.isExternalEvent(
        attendeeEmails as string[],
        organizationDomain,
        userEmail,
        event.summary ?? undefined
      );

      const meetingUrl =
        event.hangoutLink ||
        event.conferenceData?.entryPoints?.find(
          (ep) => ep.entryPointType === 'video'
        )?.uri ||
        null;

      const startDateTime = event.start?.dateTime || event.start?.date;
      const endDateTime = event.end?.dateTime || event.end?.date;

      if (!event.id || !startDateTime || !endDateTime) {
        throw new Error('Event missing required fields');
      }

      return {
        id: event.id,
        summary: event.summary || '(No title)',
        description: event.description || null,
        location: event.location || null,
        startTime: new Date(startDateTime),
        endTime: new Date(endDateTime),
        attendees: attendeeEmails as string[],
        isExternal,
        organizerEmail: event.organizer?.email || null,
        meetingUrl,
      };
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Deletes a calendar event
   */
  async deleteEvent(
    userId: string,
    eventId: string,
    sendUpdates: 'all' | 'externalOnly' | 'none' = 'none'
  ): Promise<void> {
    try {
      const calendar = await this.getClient(userId);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId,
        sendUpdates,
      });
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * Checks if an event has external attendees
   * (compares attendee email domains with organization domain)
   *
   * @param attendees - List of attendee email addresses
   * @param organizationDomain - Organization's domain (e.g., "verifiable.com")
   * @param currentUserEmail - Email of current user to exclude from check (optional)
   */
  private isExternalEvent(
    attendees: string[],
    organizationDomain: string,
    currentUserEmail?: string,
    eventSummary?: string
  ): boolean {
    // Early validation checks
    if (!organizationDomain) {
      console.warn('[Calendar] isExternalEvent: Organization domain not set - marking as internal');
      return false;
    }

    if (attendees.length === 0) {
      console.log('[Calendar] isExternalEvent: No attendees - marking as internal');
      return false;
    }

    // Normalize organization domain by removing common prefixes
    // e.g., "www.verifiable.com" becomes "verifiable.com"
    const orgDomain = organizationDomain.toLowerCase().replace(/^www\./, '');

    // Filter out current user's email to avoid false negatives
    // (user is always in their own meetings, but that doesn't make them internal)
    const otherAttendees = currentUserEmail
      ? attendees.filter(email => email.toLowerCase() !== currentUserEmail.toLowerCase())
      : attendees;

    // If only the user is in the meeting (no other attendees), it's not external
    if (otherAttendees.length === 0) {
      console.log(`[Calendar] isExternalEvent: "${eventSummary}" - Only user in meeting - marking as internal`);
      return false;
    }

    // Check if any other attendee has a different domain
    const externalAttendees = otherAttendees.filter((email) => {
      const rawEmailDomain = email.split('@')[1]?.toLowerCase();
      if (!rawEmailDomain) {
        return false;
      }

      // Normalize email domain by removing www. prefix (to match org domain normalization)
      const emailDomain = rawEmailDomain.replace(/^www\./, '');

      // Exact match or subdomain match
      // e.g., "acme.com" matches "acme.com" and "us.acme.com" but not "acme.company.com"
      const isExternal = emailDomain !== orgDomain && !emailDomain.endsWith(`.${orgDomain}`);

      if (isExternal) {
        console.log(`[Calendar] isExternalEvent: "${eventSummary}" - Found external domain: ${emailDomain} (org: ${orgDomain})`);
      }

      return isExternal;
    });

    const isExternal = externalAttendees.length > 0;

    if (!isExternal) {
      const domains = otherAttendees.map(email => email.split('@')[1]).join(', ');
      console.log(`[Calendar] isExternalEvent: "${eventSummary}" - All internal domains: ${domains} (org: ${orgDomain})`);
    }

    return isExternal;
  }
}

// Export a singleton instance
export const googleCalendarClient = new GoogleCalendarClient();
