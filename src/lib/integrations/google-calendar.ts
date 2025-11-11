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

      // Transform Google Calendar events to our format
      const events = response.data.items
        .map((event) => {
          const attendeeEmails =
            event.attendees?.map((a) => a.email).filter(Boolean) || [];

          const isExternal = this.isExternalEvent(
            attendeeEmails as string[],
            organizationDomain
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

      const attendeeEmails =
        event.attendees?.map((a) => a.email).filter(Boolean) || [];

      const isExternal = this.isExternalEvent(
        attendeeEmails as string[],
        organizationDomain
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

      const attendeeEmails =
        event.attendees?.map((a) => a.email).filter(Boolean) || [];

      const isExternal = this.isExternalEvent(
        attendeeEmails as string[],
        organizationDomain
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

      const attendeeEmails =
        event.attendees?.map((a) => a.email).filter(Boolean) || [];

      const isExternal = this.isExternalEvent(
        attendeeEmails as string[],
        organizationDomain
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
   */
  private isExternalEvent(
    attendees: string[],
    organizationDomain: string
  ): boolean {
    if (!organizationDomain || attendees.length === 0) {
      return false;
    }

    const orgDomain = organizationDomain.toLowerCase();

    // Check if any attendee has a different domain
    return attendees.some((email) => {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (!emailDomain) {
        return false;
      }

      // Exact match or subdomain match
      // e.g., "acme.com" matches "acme.com" and "us.acme.com" but not "acme.company.com"
      return emailDomain !== orgDomain && !emailDomain.endsWith(`.${orgDomain}`);
    });
  }
}

// Export a singleton instance
export const googleCalendarClient = new GoogleCalendarClient();
