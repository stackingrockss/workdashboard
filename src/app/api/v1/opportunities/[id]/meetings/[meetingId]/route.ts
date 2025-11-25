import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { updateManualMeetingSchema } from "@/lib/validations/calendar";

// GET /api/v1/opportunities/[id]/meetings/[meetingId] - Get a single meeting
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  const { id, meetingId } = await params;
  try {
    const user = await requireAuth();

    const event = await prisma.calendarEvent.findFirst({
      where: {
        id: meetingId,
        opportunityId: id,
        user: {
          organizationId: user.organization.id,
        },
      },
      include: {
        gongCalls: true,
        granolaNotes: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Failed to fetch meeting:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch meeting" }, { status: 500 });
  }
}

// PATCH /api/v1/opportunities/[id]/meetings/[meetingId] - Update a manual meeting
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  const { id, meetingId } = await params;
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = updateManualMeetingSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Find the existing meeting and verify it's a manual one
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: {
        id: meetingId,
        opportunityId: id,
        user: {
          organizationId: user.organization.id,
        },
      },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (existingEvent.source !== "manual") {
      return NextResponse.json(
        { error: "Only manual meetings can be edited" },
        { status: 403 }
      );
    }

    const event = await prisma.calendarEvent.update({
      where: { id: meetingId },
      data: {
        summary: parsed.data.summary,
        description: parsed.data.description,
        startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : undefined,
        endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : undefined,
        meetingUrl: parsed.data.meetingUrl,
      },
      include: {
        gongCalls: true,
        granolaNotes: true,
      },
    });

    revalidatePath(`/opportunities/${id}`);
    return NextResponse.json({ event });
  } catch (error) {
    console.error("Failed to update meeting:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 });
  }
}

// DELETE /api/v1/opportunities/[id]/meetings/[meetingId] - Delete a manual meeting
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  const { id, meetingId } = await params;
  try {
    const user = await requireAuth();

    // Find the existing meeting and verify it's a manual one
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: {
        id: meetingId,
        opportunityId: id,
        user: {
          organizationId: user.organization.id,
        },
      },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (existingEvent.source !== "manual") {
      return NextResponse.json(
        { error: "Only manual meetings can be deleted" },
        { status: 403 }
      );
    }

    await prisma.calendarEvent.delete({
      where: { id: meetingId },
    });

    revalidatePath(`/opportunities/${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete meeting:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 });
  }
}
