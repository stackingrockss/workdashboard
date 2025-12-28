import type { NextCallDateSource } from "@prisma/client";

/**
 * Result of CBC (Contact Before Call) date calculation
 */
export interface CbcCalculation {
  /** The calculated CBC date (midpoint between last and next call) */
  cbcDate: Date | null;
  /** The most recent past meeting date */
  lastCallDate: Date | null;
  /** Source of the last call date */
  lastCallDateSource: NextCallDateSource | null;
  /** Event ID of the last call */
  lastCallDateEventId: string | null;
  /** The next scheduled meeting date */
  nextCallDate: Date | null;
  /** Source of the next call date */
  nextCallDateSource: NextCallDateSource | null;
  /** Event ID of the next call */
  nextCallDateEventId: string | null;
  /** Flag indicating no next call is scheduled (needs attention) */
  needsNextCallScheduled: boolean;
}

/**
 * Meeting data for CBC calculation
 */
export interface MeetingData {
  date: Date;
  source: NextCallDateSource;
  eventId: string;
}

/**
 * Calculate the last call date from meeting sources.
 * Returns the most recent meeting that has already occurred.
 *
 * @param meetings - Array of meetings with date, source, and eventId
 * @returns The most recent past meeting or null values if none found
 */
export function calculateLastCallDate(
  meetings: MeetingData[]
): { date: Date | null; source: NextCallDateSource | null; eventId: string | null } {
  const now = new Date();

  // Filter to past meetings only
  const pastMeetings = meetings.filter((m) => m.date <= now);

  if (pastMeetings.length === 0) {
    return { date: null, source: null, eventId: null };
  }

  // Sort by date descending (most recent first)
  pastMeetings.sort((a, b) => b.date.getTime() - a.date.getTime());

  const mostRecent = pastMeetings[0];
  return {
    date: mostRecent.date,
    source: mostRecent.source,
    eventId: mostRecent.eventId,
  };
}

/**
 * Calculate the next call date from meeting sources.
 * Returns the earliest future meeting.
 *
 * @param meetings - Array of meetings with date, source, and eventId
 * @returns The earliest future meeting or null values if none found
 */
export function calculateNextCallDate(
  meetings: MeetingData[]
): { date: Date | null; source: NextCallDateSource | null; eventId: string | null } {
  const now = new Date();

  // Filter to future meetings only
  const futureMeetings = meetings.filter((m) => m.date > now);

  if (futureMeetings.length === 0) {
    return { date: null, source: null, eventId: null };
  }

  // Sort by date ascending (earliest first)
  futureMeetings.sort((a, b) => a.date.getTime() - b.date.getTime());

  const earliest = futureMeetings[0];
  return {
    date: earliest.date,
    source: earliest.source,
    eventId: earliest.eventId,
  };
}

/**
 * Calculate the CBC (Contact Before Call) date using midpoint strategy.
 *
 * Formula: CBC = Last Call Date + ((Next Call Date - Last Call Date) / 2)
 *
 * The CBC date represents the optimal time to reach out to a prospect
 * between scheduled calls to stay top of mind.
 *
 * @param lastCallDate - The most recent past meeting date
 * @param nextCallDate - The next scheduled meeting date
 * @returns The calculated CBC date, or null if calculation not possible
 *
 * @example
 * // Last call: Dec 15, Next call: Dec 29 (14 day gap)
 * // CBC: Dec 22 (midpoint, 7 days after last call)
 * const cbc = calculateCbcMidpoint(new Date('2024-12-15'), new Date('2024-12-29'));
 */
export function calculateCbcMidpoint(
  lastCallDate: Date | null,
  nextCallDate: Date | null
): Date | null {
  // Need both dates to calculate midpoint
  if (!lastCallDate || !nextCallDate) {
    return null;
  }

  const gapMs = nextCallDate.getTime() - lastCallDate.getTime();

  // Sanity check: next call should be after last call
  if (gapMs <= 0) {
    return null;
  }

  const midpointMs = lastCallDate.getTime() + gapMs / 2;
  return new Date(midpointMs);
}

/**
 * Calculate all CBC-related dates for an opportunity from meeting data.
 *
 * This is the main function to use for CBC calculation. It:
 * 1. Determines the last call date (most recent past meeting)
 * 2. Determines the next call date (earliest future meeting)
 * 3. Calculates the CBC date as the midpoint
 * 4. Sets needsNextCallScheduled flag if no future meeting exists
 *
 * @param meetings - Array of all meetings (past and future) from all sources
 * @returns Complete CBC calculation result
 *
 * @example
 * const meetings = [
 *   { date: new Date('2024-12-15'), source: 'auto_calendar', eventId: 'evt_1' },
 *   { date: new Date('2024-12-29'), source: 'auto_calendar', eventId: 'evt_2' },
 * ];
 * const result = calculateCbcDates(meetings);
 * // result.cbcDate = Dec 22
 * // result.needsNextCallScheduled = false
 */
export function calculateCbcDates(meetings: MeetingData[]): CbcCalculation {
  const lastCall = calculateLastCallDate(meetings);
  const nextCall = calculateNextCallDate(meetings);

  // Calculate CBC using midpoint strategy
  const cbcDate = calculateCbcMidpoint(lastCall.date, nextCall.date);

  // Flag as needing attention if we have a last call but no next call scheduled
  const needsNextCallScheduled = lastCall.date !== null && nextCall.date === null;

  return {
    cbcDate,
    lastCallDate: lastCall.date,
    lastCallDateSource: lastCall.source,
    lastCallDateEventId: lastCall.eventId,
    nextCallDate: nextCall.date,
    nextCallDateSource: nextCall.source,
    nextCallDateEventId: nextCall.eventId,
    needsNextCallScheduled,
  };
}

/**
 * Check if a CBC date is due (today or in the past)
 *
 * @param cbcDate - The CBC date to check
 * @returns true if the CBC date is today or has passed
 */
export function isCbcDue(cbcDate: Date | null): boolean {
  if (!cbcDate) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cbcDay = new Date(
    cbcDate.getFullYear(),
    cbcDate.getMonth(),
    cbcDate.getDate()
  );

  return cbcDay <= today;
}

/**
 * Check if a CBC date is overdue (in the past, not today)
 *
 * @param cbcDate - The CBC date to check
 * @returns true if the CBC date has passed (not including today)
 */
export function isCbcOverdue(cbcDate: Date | null): boolean {
  if (!cbcDate) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cbcDay = new Date(
    cbcDate.getFullYear(),
    cbcDate.getMonth(),
    cbcDate.getDate()
  );

  return cbcDay < today;
}

/**
 * Get the number of days until CBC date
 *
 * @param cbcDate - The CBC date
 * @returns Number of days (negative if overdue, 0 if today)
 */
export function getDaysUntilCbc(cbcDate: Date | null): number | null {
  if (!cbcDate) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cbcDay = new Date(
    cbcDate.getFullYear(),
    cbcDate.getMonth(),
    cbcDate.getDate()
  );

  const diffMs = cbcDay.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
