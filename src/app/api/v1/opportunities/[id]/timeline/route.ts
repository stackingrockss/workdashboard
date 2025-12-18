// GET /api/v1/opportunities/[id]/timeline
// Fetches timeline of Calendar events for an opportunity (with linked Gong/Granola)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  calendarEventWithLinksToTimelineEvent,
  sortTimelineEvents,
  type TimelineEvent,
} from "@/types/timeline";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params;

    // Get authenticated user and organization
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      select: { organizationId: true },
    });

    if (!dbUser?.organizationId) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 403 }
      );
    }

    const organizationId = dbUser.organizationId;

    // Verify opportunity belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId,
      },
      select: { id: true },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Parse query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const dateRange = searchParams.get("dateRange"); // "30", "60", "90", or "all"

    // Calculate date filter
    let dateFilter: Date | undefined;
    if (dateRange && dateRange !== "all") {
      const daysAgo = parseInt(dateRange, 10);
      if (!isNaN(daysAgo)) {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - daysAgo);
      }
    }

    // Fetch Calendar events with linked Gong/Granola records
    const calendarEvents = await prisma.calendarEvent.findMany({
      where: {
        opportunityId,
        ...(dateFilter && {
          startTime: {
            gte: dateFilter,
          },
        }),
      },
      include: {
        gongCalls: {
          select: {
            id: true,
            title: true,
            url: true,
            parsingStatus: true,
            painPoints: true,
            goals: true,
            nextSteps: true,
          },
          take: 1,
        },
        granolaNotes: {
          select: {
            id: true,
            title: true,
            url: true,
            parsingStatus: true,
            painPoints: true,
            goals: true,
            nextSteps: true,
          },
          take: 1,
        },
      },
      orderBy: {
        startTime: "desc",
      },
    });

    // Query most recent parsed Gong call (priority)
    const mostRecentGong = await prisma.gongCall.findFirst({
      where: { opportunityId, parsingStatus: "completed" },
      orderBy: { meetingDate: "desc" },
      select: {
        id: true,
        title: true,
        meetingDate: true,
        painPoints: true,
        goals: true,
        nextSteps: true,
      },
    });

    // Fallback to Granola if no Gong
    const mostRecentGranola = !mostRecentGong
      ? await prisma.granolaNote.findFirst({
          where: { opportunityId, parsingStatus: "completed" },
          orderBy: { meetingDate: "desc" },
          select: {
            id: true,
            title: true,
            meetingDate: true,
            painPoints: true,
            goals: true,
            nextSteps: true,
          },
        })
      : null;

    const mostRecentCall = mostRecentGong
      ? { ...mostRecentGong, type: "gong" as const }
      : mostRecentGranola
        ? { ...mostRecentGranola, type: "granola" as const }
        : null;

    // Convert to timeline events and sort
    const events: TimelineEvent[] = calendarEvents.map(calendarEventWithLinksToTimelineEvent);
    const sortedEvents = sortTimelineEvents(events);

    // Check if pagination is requested
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
      const total = sortedEvents.length;

      // Apply pagination to sorted events
      const paginatedEvents = sortedEvents.slice(skip, skip + limit);

      const response = buildPaginatedResponse(paginatedEvents, page, limit, total, 'events');
      return cachedResponse(
        {
          ...response,
          mostRecentCall,
          meta: {
            meetingCount: events.length,
          },
        },
        'frequent'
      );
    } else {
      // LEGACY MODE: No pagination params, return all events
      const response = buildLegacyResponse(sortedEvents, 'events');
      return cachedResponse(
        {
          ...response,
          mostRecentCall,
          meta: {
            totalCount: sortedEvents.length,
            meetingCount: events.length,
          },
        },
        'frequent'
      );
    }
  } catch (error) {
    console.error("Error fetching timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
