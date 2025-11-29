import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { gongCallCreateSchema } from "@/lib/validations/gong-call";
import { triggerTranscriptParsingAsync } from "@/lib/ai/background-transcript-parsing";
import { requireAuth } from "@/lib/auth";
import { recalculateNextCallDateForOpportunity } from "@/lib/utils/next-call-date-calculator";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";

// GET /api/v1/opportunities/[id]/gong-calls - List all Gong calls for an opportunity
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
        organizationId: user.organization.id
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const whereClause = { opportunityId: id };
    const usePagination = wantsPagination(searchParams);

    if (usePagination) {
      // PAGINATED MODE: Client requested pagination via query params
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 25, // Default to 25 (lower due to large transcript data)
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 25;
      const skip = (page - 1) * limit;

      // Parallel queries for performance
      const [total, calls] = await Promise.all([
        prisma.gongCall.count({ where: whereClause }),
        prisma.gongCall.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      return cachedResponse(
        buildPaginatedResponse(calls, page, limit, total, 'calls'),
        'frequent'
      );
    } else {
      // LEGACY MODE: No pagination params, return all calls
      const calls = await prisma.gongCall.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
      });
      return cachedResponse(buildLegacyResponse(calls, 'calls'), 'frequent');
    }
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

    // Recalculate next call date for the opportunity
    try {
      await recalculateNextCallDateForOpportunity(id);
    } catch (recalcError) {
      // Log but don't fail - recalculation will happen via background job
      console.error('[POST gong-call] Failed to recalculate next call date:', recalcError);
    }

    // Revalidate the opportunity detail page to show new call immediately
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    console.error('Failed to create Gong call:', error);
    return NextResponse.json({ error: "Failed to create Gong call" }, { status: 500 });
  }
}
