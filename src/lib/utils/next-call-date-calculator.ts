import { prisma } from "@/lib/db";
import type { NextCallDateSource } from "@prisma/client";
import {
  calculateCbcDates,
  type CbcCalculation,
  type MeetingData,
} from "./cbc-calculator";
import { processCbcTaskForOpportunity } from "./cbc-task-creator";

/**
 * Result of next call date calculation
 */
export interface NextCallDateCalculation {
  /** The calculated next call date, or null if no future meetings */
  nextCallDate: Date | null;
  /** Source of the date: auto_calendar, auto_gong, auto_granola, or manual */
  source: NextCallDateSource | null;
  /** ID of the source event (CalendarEvent, GongCall, or GranolaNote) */
  eventId: string | null;
}

/**
 * Result of full opportunity date recalculation (includes CBC)
 */
export interface OpportunityDatesCalculation extends CbcCalculation {
  /** Timestamp of when calculation was performed */
  calculatedAt: Date;
}

/**
 * Opportunity with meeting relations for calculation
 * @internal
 */
interface OpportunityWithMeetings {
  id: string;
  calendarEvents?: Array<{ id: string; startTime: Date }>;
  gongCalls?: Array<{ id: string; meetingDate: Date }>;
  granolaNotes?: Array<{ id: string; meetingDate: Date }>;
}

/**
 * Convert opportunity meeting data to unified MeetingData array
 */
function collectMeetingsFromOpportunity(
  opportunity: OpportunityWithMeetings
): MeetingData[] {
  const meetings: MeetingData[] = [];

  // Collect from CalendarEvents (external only - filtered at query level)
  opportunity.calendarEvents?.forEach((e) =>
    meetings.push({
      date: e.startTime,
      source: "auto_calendar",
      eventId: e.id,
    })
  );

  // Collect from GongCalls
  opportunity.gongCalls?.forEach((c) =>
    meetings.push({
      date: c.meetingDate,
      source: "auto_gong",
      eventId: c.id,
    })
  );

  // Collect from GranolaNotes
  opportunity.granolaNotes?.forEach((n) =>
    meetings.push({
      date: n.meetingDate,
      source: "auto_granola",
      eventId: n.id,
    })
  );

  return meetings;
}

/**
 * Calculate the next call date for an opportunity from all meeting sources.
 *
 * Priority order (highest to lowest):
 * 1. CalendarEvent (external only) - From Google Calendar integration
 * 2. GongCall - From Gong call recordings
 * 3. GranolaNote - From Granola meeting notes
 *
 * @param opportunity - Opportunity with related meetings (calendarEvents, gongCalls, granolaNotes)
 * @returns Calculation result with next call date, source, and event ID
 *
 * @example
 * const opportunity = await prisma.opportunity.findUnique({
 *   where: { id: 'opp_123' },
 *   include: { calendarEvents: true, gongCalls: true, granolaNotes: true }
 * });
 * const result = calculateNextCallDate(opportunity);
 * console.log(result.nextCallDate); // 2025-12-04T20:00:00.000Z
 * console.log(result.source);       // 'auto_calendar'
 */
export function calculateNextCallDate(
  opportunity: OpportunityWithMeetings
): NextCallDateCalculation {
  const now = new Date();
  const futureMeetings: Array<{
    date: Date;
    source: NextCallDateSource;
    eventId: string;
  }> = [];

  // Collect from CalendarEvents (external only - filtered at query level)
  opportunity.calendarEvents
    ?.filter((e) => e.startTime > now)
    .forEach((e) =>
      futureMeetings.push({
        date: e.startTime,
        source: "auto_calendar",
        eventId: e.id,
      })
    );

  // Collect from GongCalls
  opportunity.gongCalls
    ?.filter((c) => c.meetingDate > now)
    .forEach((c) =>
      futureMeetings.push({
        date: c.meetingDate,
        source: "auto_gong",
        eventId: c.id,
      })
    );

  // Collect from GranolaNotes
  opportunity.granolaNotes
    ?.filter((n) => n.meetingDate > now)
    .forEach((n) =>
      futureMeetings.push({
        date: n.meetingDate,
        source: "auto_granola",
        eventId: n.id,
      })
    );

  // Sort by date (earliest first)
  futureMeetings.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Return earliest or null
  if (futureMeetings.length === 0) {
    return { nextCallDate: null, source: null, eventId: null };
  }

  const earliest = futureMeetings[0];
  return {
    nextCallDate: earliest.date,
    source: earliest.source,
    eventId: earliest.eventId,
  };
}

/**
 * Recalculate and update the next call date for an opportunity.
 *
 * This function:
 * 1. Fetches the opportunity with all meeting sources (CalendarEvent, GongCall, GranolaNote)
 * 2. Calculates the next call date from the earliest future meeting
 * 3. Updates the database with the calculated result
 * 4. Always recalculates regardless of manual override flag (external meetings take precedence)
 *
 * @param opportunityId - The ID of the opportunity to recalculate
 * @returns The calculated next call date, source, and event ID
 * @throws Error if opportunity not found
 *
 * @example
 * // Trigger recalculation after adding a calendar event
 * await recalculateNextCallDateForOpportunity('opp_123');
 *
 * @example
 * // Get the calculated result
 * const result = await recalculateNextCallDateForOpportunity('opp_123');
 * if (result.nextCallDate) {
 *   console.log(`Next call: ${result.nextCallDate.toISOString()}`);
 *   console.log(`Source: ${result.source}`);
 * }
 *
 * @deprecated Use recalculateOpportunityDates instead for full CBC calculation
 */
export async function recalculateNextCallDateForOpportunity(
  opportunityId: string
): Promise<NextCallDateCalculation> {
  // Fetch opportunity with all meeting sources
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      calendarEvents: {
        where: { isExternal: true }, // Only external meetings
        orderBy: { startTime: "asc" },
      },
      gongCalls: { orderBy: { meetingDate: "asc" } },
      granolaNotes: { orderBy: { meetingDate: "asc" } },
    },
  });

  if (!opportunity) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }

  // Calculate next call date from meetings
  const calculated = calculateNextCallDate(opportunity);

  // Update database (ALWAYS update, no manual override check)
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      nextCallDate: calculated.nextCallDate,
      nextCallDateSource: calculated.source,
      nextCallDateLastCalculated: new Date(),
      nextCallDateEventId: calculated.eventId,
    },
  });

  return calculated;
}

/**
 * Recalculate all dates for an opportunity including CBC.
 *
 * This function:
 * 1. Fetches the opportunity with all meeting sources (CalendarEvent, GongCall, GranolaNote)
 * 2. Calculates the last call date (most recent past meeting)
 * 3. Calculates the next call date (earliest future meeting)
 * 4. Calculates the CBC date (midpoint between last and next)
 * 5. Sets needsNextCallScheduled flag if there's a past meeting but no future meeting
 * 6. Updates all fields in a single database transaction
 *
 * @param opportunityId - The ID of the opportunity to recalculate
 * @returns Complete calculation result with all dates and flags
 * @throws Error if opportunity not found
 *
 * @example
 * const result = await recalculateOpportunityDates('opp_123');
 * console.log(result.cbcDate);               // 2024-12-22
 * console.log(result.needsNextCallScheduled); // false
 */
export async function recalculateOpportunityDates(
  opportunityId: string
): Promise<OpportunityDatesCalculation> {
  // Fetch opportunity with all meeting sources
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      calendarEvents: {
        where: { isExternal: true }, // Only external meetings
        orderBy: { startTime: "asc" },
      },
      gongCalls: { orderBy: { meetingDate: "asc" } },
      granolaNotes: { orderBy: { meetingDate: "asc" } },
    },
  });

  if (!opportunity) {
    throw new Error(`Opportunity ${opportunityId} not found`);
  }

  // Collect all meetings into unified format
  const meetings = collectMeetingsFromOpportunity(opportunity);

  // Calculate all dates using CBC calculator
  const calculated = calculateCbcDates(meetings);
  const calculatedAt = new Date();

  // Update database with all calculated values
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      // Last call date fields
      lastCallDate: calculated.lastCallDate,
      lastCallDateSource: calculated.lastCallDateSource,
      lastCallDateEventId: calculated.lastCallDateEventId,
      // Next call date fields
      nextCallDate: calculated.nextCallDate,
      nextCallDateSource: calculated.nextCallDateSource,
      nextCallDateLastCalculated: calculatedAt,
      nextCallDateEventId: calculated.nextCallDateEventId,
      // CBC fields
      cbc: calculated.cbcDate,
      cbcLastCalculated: calculatedAt,
      // Warning flag
      needsNextCallScheduled: calculated.needsNextCallScheduled,
    },
  });

  // Process CBC task (create, update, or delete based on calculated dates)
  // This runs asynchronously but we don't wait for it to complete
  processCbcTaskForOpportunity(opportunityId).catch((error) => {
    console.error(`[recalculateOpportunityDates] Failed to process CBC task for ${opportunityId}:`, error);
  });

  return {
    ...calculated,
    calculatedAt,
  };
}

/**
 * Recalculate dates for multiple opportunities.
 * Useful for batch processing or scheduled jobs.
 *
 * @param opportunityIds - Array of opportunity IDs to recalculate
 * @returns Array of calculation results
 */
export async function recalculateOpportunityDatesBatch(
  opportunityIds: string[]
): Promise<Array<{ opportunityId: string; result: OpportunityDatesCalculation | null; error?: string }>> {
  const results: Array<{ opportunityId: string; result: OpportunityDatesCalculation | null; error?: string }> = [];

  for (const opportunityId of opportunityIds) {
    try {
      const result = await recalculateOpportunityDates(opportunityId);
      results.push({ opportunityId, result });
    } catch (error) {
      results.push({
        opportunityId,
        result: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
