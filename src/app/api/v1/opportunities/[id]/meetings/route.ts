import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createManualMeetingSchema } from "@/lib/validations/calendar";

// GET /api/v1/opportunities/[id]/meetings - List all calendar events for an opportunity
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
        organizationId: user.organization.id,
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const events = await prisma.calendarEvent.findMany({
      where: { opportunityId: id },
      include: {
        gongCalls: true,
        granolaNotes: true,
      },
      orderBy: { startTime: "desc" },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Failed to fetch meetings:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 });
  }
}

// POST /api/v1/opportunities/[id]/meetings - Create a manual meeting
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = createManualMeetingSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify opportunity exists and belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
      include: { account: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Create the manual calendar event
    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        googleEventId: null,
        source: "manual",
        summary: parsed.data.summary,
        description: parsed.data.description,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        attendees: [],
        isExternal: true,
        organizerEmail: user.email,
        meetingUrl: parsed.data.meetingUrl,
        opportunityId: id,
        accountId: opportunity.accountId,
      },
      include: {
        gongCalls: true,
        granolaNotes: true,
      },
    });

    revalidatePath(`/opportunities/${id}`);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Failed to create manual meeting:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
  }
}
