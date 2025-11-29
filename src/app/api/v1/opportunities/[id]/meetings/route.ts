import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createManualMeetingSchema } from "@/lib/validations/calendar";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

// GET /api/v1/opportunities/[id]/meetings - List all calendar events for an opportunity
export async function GET(
  req: NextRequest,
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

    const searchParams = req.nextUrl.searchParams;
    const whereClause = { opportunityId: id };
    const usePagination = wantsPagination(searchParams);

    // Define include for relations
    const includeRelations = {
      gongCalls: true,
      granolaNotes: true,
    };

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
          include: includeRelations,
          orderBy: { startTime: "desc" },
          skip,
          take: limit,
        }),
      ]);

      return cachedResponse(
        buildPaginatedResponse(events, page, limit, total, 'events'),
        'frequent'
      );
    } else {
      // LEGACY MODE: No pagination params, return all events
      const events = await prisma.calendarEvent.findMany({
        where: whereClause,
        include: includeRelations,
        orderBy: { startTime: "desc" },
      });

      return cachedResponse(buildLegacyResponse(events, 'events'), 'frequent');
    }
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
