// GET /api/v1/opportunities/[id]/timeline
// Fetches unified timeline of Gong calls and Granola notes for an opportunity

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  gongCallToTimelineEvent,
  granolaToTimelineEvent,
  sortTimelineEvents,
  type TimelineEvent,
} from "@/types/timeline";

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
    const eventType = searchParams.get("eventType"); // "all", "gong_calls", "granola_notes"

    // Calculate date filter
    let dateFilter: Date | undefined;
    if (dateRange && dateRange !== "all") {
      const daysAgo = parseInt(dateRange, 10);
      if (!isNaN(daysAgo)) {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - daysAgo);
      }
    }

    // Fetch Gong calls
    const shouldFetchGong =
      !eventType || eventType === "all" || eventType === "gong_calls";
    const gongCalls = shouldFetchGong
      ? await prisma.gongCall.findMany({
          where: {
            opportunityId,
            ...(dateFilter && {
              meetingDate: {
                gte: dateFilter,
              },
            }),
          },
          orderBy: {
            meetingDate: "desc",
          },
        })
      : [];

    // Fetch Granola notes
    const shouldFetchGranola =
      !eventType || eventType === "all" || eventType === "granola_notes";
    const granolaNotes = shouldFetchGranola
      ? await prisma.granolaNote.findMany({
          where: {
            opportunityId,
            ...(dateFilter && {
              meetingDate: {
                gte: dateFilter,
              },
            }),
          },
          orderBy: {
            meetingDate: "desc",
          },
        })
      : [];

    // Convert to timeline events
    const gongEvents = gongCalls.map(gongCallToTimelineEvent);
    const granolaEvents = granolaNotes.map(granolaToTimelineEvent);

    // Merge and sort
    const allEvents: TimelineEvent[] = [...gongEvents, ...granolaEvents];
    const sortedEvents = sortTimelineEvents(allEvents);

    return NextResponse.json({
      events: sortedEvents,
      meta: {
        totalCount: sortedEvents.length,
        gongCallCount: gongEvents.length,
        granolaNotesCount: granolaEvents.length,
      },
    });
  } catch (error) {
    console.error("Error fetching timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
