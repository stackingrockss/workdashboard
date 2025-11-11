import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleCalendarClient } from '@/lib/integrations/google-calendar';
import { updateCalendarEventSchema } from '@/lib/validations/calendar';

/**
 * PATCH /api/v1/integrations/google/calendar/events/[eventId]
 * Updates an existing calendar event
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

    // Optionally: Update event in database if you're storing events
    // (Uncomment if you want to sync with DB)
    // await prisma.calendarEvent.updateMany({
    //   where: {
    //     userId: user.id,
    //     googleEventId: eventId,
    //   },
    //   data: {
    //     summary: updatedEvent.summary,
    //     description: updatedEvent.description,
    //     location: updatedEvent.location,
    //     startTime: updatedEvent.startTime,
    //     endTime: updatedEvent.endTime,
    //     attendees: updatedEvent.attendees,
    //     isExternal: updatedEvent.isExternal,
    //     organizerEmail: updatedEvent.organizerEmail,
    //     meetingUrl: updatedEvent.meetingUrl,
    //     updatedAt: new Date(),
    //   },
    // });

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

    // Parse query parameters for sendUpdates option
    const sendUpdates = (req.nextUrl.searchParams.get('sendUpdates') ||
      'none') as 'all' | 'externalOnly' | 'none';

    // Delete event from Google Calendar
    await googleCalendarClient.deleteEvent(user.id, eventId, sendUpdates);

    // Optionally: Delete event from database if you're storing events
    // (Uncomment if you want to sync with DB)
    // await prisma.calendarEvent.deleteMany({
    //   where: {
    //     userId: user.id,
    //     googleEventId: eventId,
    //   },
    // });

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
