import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleCalendarClient } from '@/lib/integrations/google-calendar';
import { updateCalendarEventSchema } from '@/lib/validations/calendar';

/**
 * PATCH /api/v1/integrations/google/calendar/events/[eventId]
 * Updates an existing calendar event
 *
 * NOTE: Calendar write access is currently disabled. This endpoint will return 403.
 * Use Google Tasks integration for managing action items instead.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

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

    // Check if user has write scope
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

    const hasWriteAccess = oauthToken.scopes.includes(
      'https://www.googleapis.com/auth/calendar.events'
    );

    if (!hasWriteAccess) {
      return NextResponse.json(
        {
          error: 'Calendar write access disabled',
          message:
            'Calendar is connected in read-only mode. Please use Google Tasks to manage action items instead.',
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = updateCalendarEventSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid event data', details: validation.error },
        { status: 400 }
      );
    }

    const eventData = validation.data;

    // Convert date strings to Date objects if present
    const updateData = {
      ...eventData,
      startTime: eventData.startTime
        ? new Date(eventData.startTime)
        : undefined,
      endTime: eventData.endTime ? new Date(eventData.endTime) : undefined,
    };

    // Update event in Google Calendar
    const updatedEvent = await googleCalendarClient.updateEvent(
      user.id,
      eventId,
      updateData
    );

    // Update event in database (Phase 3A: persistent storage)
    try {
      await prisma.calendarEvent.updateMany({
        where: {
          userId: user.id,
          googleEventId: eventId,
        },
        data: {
          summary: updatedEvent.summary,
          description: updatedEvent.description,
          location: updatedEvent.location,
          startTime: updatedEvent.startTime,
          endTime: updatedEvent.endTime,
          attendees: updatedEvent.attendees,
          isExternal: updatedEvent.isExternal,
          organizerEmail: updatedEvent.organizerEmail,
          meetingUrl: updatedEvent.meetingUrl,
        },
      });
    } catch (dbError) {
      // Log but don't fail the request if DB update fails
      // (Event is already updated in Google Calendar)
      console.error('Failed to update event in database:', dbError);
    }

    return NextResponse.json({ event: updatedEvent });
  } catch (error) {
    console.error('Failed to update calendar event:', error);

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
      { error: 'Failed to update calendar event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/integrations/google/calendar/events/[eventId]
 * Deletes a calendar event
 *
 * NOTE: Calendar write access is currently disabled. This endpoint will return 403.
 * Use Google Tasks integration for managing action items instead.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

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

    // Check if user has write scope
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

    const hasWriteAccess = oauthToken.scopes.includes(
      'https://www.googleapis.com/auth/calendar.events'
    );

    if (!hasWriteAccess) {
      return NextResponse.json(
        {
          error: 'Calendar write access disabled',
          message:
            'Calendar is connected in read-only mode. Please use Google Tasks to manage action items instead.',
        },
        { status: 403 }
      );
    }

    // Parse query parameters for sendUpdates option
    const sendUpdates = (req.nextUrl.searchParams.get('sendUpdates') ||
      'none') as 'all' | 'externalOnly' | 'none';

    // Delete event from Google Calendar
    await googleCalendarClient.deleteEvent(user.id, eventId, sendUpdates);

    // Delete event from database (Phase 3A: persistent storage)
    try {
      await prisma.calendarEvent.deleteMany({
        where: {
          userId: user.id,
          googleEventId: eventId,
        },
      });
    } catch (dbError) {
      // Log but don't fail the request if DB delete fails
      // (Event is already deleted from Google Calendar)
      console.error('Failed to delete event from database:', dbError);
    }

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete calendar event:', error);

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
      { error: 'Failed to delete calendar event' },
      { status: 500 }
    );
  }
}
