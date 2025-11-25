import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { gongCallCreateSchema } from "@/lib/validations/gong-call";
import { triggerTranscriptParsingAsync } from "@/lib/ai/background-transcript-parsing";
import { requireAuth } from "@/lib/auth";

// GET /api/v1/opportunities/[id]/gong-calls - List all Gong calls for an opportunity
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    // Verify opportunity exists and belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const calls = await prisma.gongCall.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ calls });
  } catch (error) {
    console.error('Failed to fetch Gong calls:', error);
    return NextResponse.json({ error: "Failed to fetch Gong calls" }, { status: 500 });
  }
}

// POST /api/v1/opportunities/[id]/gong-calls - Create a new Gong call
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = gongCallCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify opportunity exists and belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Check for duplicate URL
    const existingCall = await prisma.gongCall.findFirst({
      where: {
        opportunityId: id,
        url: parsed.data.url,
      },
    });

    if (existingCall) {
      return NextResponse.json(
        { error: "A call with this URL already exists for this opportunity" },
        { status: 409 }
      );
    }

    // Validate calendarEventId if provided
    let validCalendarEventId: string | undefined = undefined;
    if (parsed.data.calendarEventId) {
      console.log('[Gong Call] Looking up calendarEventId:', parsed.data.calendarEventId);

      const calendarEvent = await prisma.calendarEvent.findUnique({
        where: {
          id: parsed.data.calendarEventId,
        },
      });

      if (calendarEvent) {
        validCalendarEventId = calendarEvent.id;
        console.log('[Gong Call] Calendar event found, linking to:', calendarEvent.summary);
      } else {
        console.warn('[Gong Call] Calendar event NOT FOUND for id:', parsed.data.calendarEventId);
        // Continue without linking - user can manually link later
      }
    }

    // Create the call with optional transcript and calendar event association
    const call = await prisma.gongCall.create({
      data: {
        opportunityId: id,
        title: parsed.data.title,
        url: parsed.data.url,
        meetingDate: new Date(parsed.data.meetingDate),
        noteType: parsed.data.noteType,
        transcriptText: parsed.data.transcriptText,
        parsingStatus: parsed.data.transcriptText ? "parsing" : null,
        calendarEventId: validCalendarEventId,
      },
    });

    // If transcript was provided, trigger parsing in background
    if (parsed.data.transcriptText) {
      await triggerTranscriptParsingAsync({
        gongCallId: call.id,
        transcriptText: parsed.data.transcriptText,
      });
    }

    // Revalidate the opportunity detail page to show new call immediately
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    console.error('Failed to create Gong call:', error);
    return NextResponse.json({ error: "Failed to create Gong call" }, { status: 500 });
  }
}
