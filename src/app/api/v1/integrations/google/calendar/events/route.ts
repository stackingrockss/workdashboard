import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleCalendarClient } from '@/lib/integrations/google-calendar';
import {
  calendarEventFilterSchema,
  createCalendarEventSchema,
} from '@/lib/validations/calendar';
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from '@/lib/utils/pagination';
import { paginationQuerySchema } from '@/lib/validations/pagination';
import { cachedResponse } from '@/lib/cache';

/**
 * GET /api/v1/integrations/google/calendar/events
 * Fetches calendar events for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const filterInput = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      accountId: searchParams.get('accountId') || undefined,
      opportunityId: searchParams.get('opportunityId') || undefined,
      externalOnly: searchParams.get('externalOnly') || undefined,
      pageToken: searchParams.get('pageToken') || undefined,
      maxResults: searchParams.get('maxResults')
        ? parseInt(searchParams.get('maxResults')!)
        : undefined,
    };

    const validation = calendarEventFilterSchema.safeParse(filterInput);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: validation.error },
        { status: 400 }
      );
    }

    const filters = validation.data;

    // Set default date range if not provided (today to 30 days from now)
    const startDate = filters.startDate
      ? new Date(filters.startDate)
      : new Date();
    const endDate = filters.endDate
      ? new Date(filters.endDate)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Check if force live sync is requested (bypass database cache)
    const forceLiveSync = searchParams.get('forceLiveSync') === 'true';

    // If forceLiveSync=true, fetch directly from Google API
    if (forceLiveSync) {
      const result = await googleCalendarClient.listEvents(
        user.id,
        startDate,
        endDate,
        {
          accountId: filters.accountId,
          opportunityId: filters.opportunityId,
          externalOnly: filters.externalOnly !== false,
          pageToken: filters.pageToken,
          maxResults: filters.maxResults,
        }
      );

      return NextResponse.json({
        events: result.events,
        nextPageToken: result.nextPageToken,
        hasMore: !!result.nextPageToken,
        source: 'live',
      });
    }

    // Default: Read from database (cached events from background sync)
    // Build Prisma where clause
    const whereClause: {
      userId: string;
      startTime: { gte: Date; lte: Date };
      isExternal?: boolean;
      accountId?: string;
      opportunityId?: string;
      OR?: Array<{ opportunityId?: string; accountId?: string }>;
    } = {
      userId: user.id,
      startTime: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Apply filters
    if (filters.externalOnly !== false) {
      whereClause.isExternal = true;
    }

    // When both opportunityId and accountId are provided, use OR logic
    // This allows showing events linked to the opportunity OR to the account
    if (filters.opportunityId && filters.accountId) {
      whereClause.OR = [
        { opportunityId: filters.opportunityId },
        { accountId: filters.accountId },
      ];
    } else if (filters.accountId) {
      whereClause.accountId = filters.accountId;
    } else if (filters.opportunityId) {
      whereClause.opportunityId = filters.opportunityId;
    }

    // Define select for event fields
    const selectFields = {
      id: true, // Include the database ID for linking
      googleEventId: true,
      summary: true,
      description: true,
      location: true,
      startTime: true,
      endTime: true,
      attendees: true,
      isExternal: true,
      organizerEmail: true,
      meetingUrl: true,
      opportunityId: true,
      accountId: true,
      source: true,
    };

    // Helper to transform events
    const transformEvent = (event: {
      id: string;
      googleEventId: string | null;
      summary: string | null;
      description: string | null;
      location: string | null;
      startTime: Date | null;
      endTime: Date | null;
      attendees: string[];
      isExternal: boolean | null;
      organizerEmail: string | null;
      meetingUrl: string | null;
      opportunityId: string | null;
      accountId: string | null;
      source: string;
    }) => ({
      id: event.id, // Database ID - used for linking Gong calls/Granola notes
      googleEventId: event.googleEventId, // Google's event ID - for reference
      summary: event.summary,
      description: event.description,
      location: event.location,
      startTime: event.startTime,
      endTime: event.endTime,
      attendees: event.attendees,
      isExternal: event.isExternal,
      organizerEmail: event.organizerEmail,
      meetingUrl: event.meetingUrl,
      source: event.source,
    });

    // Detect if client wants pagination
    const usePagination = wantsPagination(searchParams);

    if (usePagination) {
      // PAGINATED MODE: Client requested pagination via query params
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 50, // Default to 50
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 50;
      const skip = (page - 1) * limit;

      // Parallel queries for performance
      const [total, events] = await Promise.all([
        prisma.calendarEvent.count({ where: whereClause }),
        prisma.calendarEvent.findMany({
          where: whereClause,
          orderBy: { startTime: 'asc' },
          select: selectFields,
          skip,
          take: limit,
        }),
      ]);

      const transformedEvents = events.map(transformEvent);
      return cachedResponse(
        buildPaginatedResponse(transformedEvents, page, limit, total, 'events'),
        'frequent'
      );
    } else {
      // LEGACY MODE: Use maxResults for backwards compatibility
      const maxResults = filters.maxResults || 50;
      const events = await prisma.calendarEvent.findMany({
        where: whereClause,
        orderBy: { startTime: 'asc' },
        take: maxResults,
        select: selectFields,
      });

      const transformedEvents = events.map(transformEvent);
      return cachedResponse(
        buildLegacyResponse(transformedEvents, 'events'),
        'frequent'
      );
    }
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);

    // Handle specific error messages
    if (error instanceof Error && error.message?.includes('Calendar not connected')) {
      return NextResponse.json(
        {
          error: 'Calendar not connected',
          message: 'Please connect your Google Calendar in Settings.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/integrations/google/calendar/events
 * Creates a new calendar event
 *
 * NOTE: Calendar write access is currently disabled. This endpoint will return 403.
 * Use Google Tasks integration for creating action items instead.
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      include: { organization: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has write scope (calendar.events)
    // If they only have calendar.readonly, block write operations
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
        {
          error: 'Calendar not connected',
          message: 'Please connect your Google Calendar in Settings.',
        },
        { status: 400 }
      );
    }

    // Check if user has write permissions
    const hasWriteAccess = oauthToken.scopes.includes(
      'https://www.googleapis.com/auth/calendar.events'
    );

    if (!hasWriteAccess) {
      return NextResponse.json(
        {
          error: 'Calendar write access disabled',
          message:
            'Calendar is connected in read-only mode. Please use Google Tasks to create action items instead.',
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = createCalendarEventSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid event data', details: validation.error },
        { status: 400 }
      );
    }

    const eventData = validation.data;

    // If opportunity ID is provided, add contacts as attendees
    if (eventData.opportunityId) {
      const opportunity = await prisma.opportunity.findUnique({
        where: {
          id: eventData.opportunityId,
          organizationId: user.organizationId!,
        },
        include: {
          contacts: { select: { email: true } },
        },
      });

      if (!opportunity) {
        return NextResponse.json(
          { error: 'Opportunity not found' },
          { status: 404 }
        );
      }

      // Add opportunity contacts to attendees
      const contactEmails = opportunity.contacts
        .map((c) => c.email)
        .filter(Boolean) as string[];

      eventData.attendees = [
        ...(eventData.attendees || []),
        ...contactEmails,
      ].filter((email, index, self) => self.indexOf(email) === index); // Remove duplicates
    }

    // Create event in Google Calendar
    const createdEvent = await googleCalendarClient.createEvent(user.id, {
      ...eventData,
      startTime: new Date(eventData.startTime),
      endTime: new Date(eventData.endTime),
    });

    // Store event in database for faster access (Phase 3A: persistent storage)
    try {
      await prisma.calendarEvent.create({
        data: {
          userId: user.id,
          googleEventId: createdEvent.id,
          summary: createdEvent.summary,
          description: createdEvent.description,
          location: createdEvent.location,
          startTime: createdEvent.startTime,
          endTime: createdEvent.endTime,
          attendees: createdEvent.attendees,
          isExternal: createdEvent.isExternal,
          organizerEmail: createdEvent.organizerEmail,
          meetingUrl: createdEvent.meetingUrl,
          opportunityId: eventData.opportunityId,
        },
      });
    } catch (dbError) {
      // Log but don't fail the request if DB write fails
      // (Event is already created in Google Calendar)
      console.error('Failed to save event to database:', dbError);
    }

    return NextResponse.json({ event: createdEvent }, { status: 201 });
  } catch (error) {
    console.error('Failed to create calendar event:', error);

    if (error instanceof Error && error.message?.includes('Calendar not connected')) {
      return NextResponse.json(
        {
          error: 'Calendar not connected',
          message: 'Please connect your Google Calendar in Settings.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}
