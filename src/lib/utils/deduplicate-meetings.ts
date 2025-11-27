// src/lib/utils/deduplicate-meetings.ts
// Smart meeting deduplication: Prioritize Gong when both Gong + Granola exist for same meeting

/**
 * Represents a meeting from either Gong or Granola
 */
interface Meeting {
  id: string;
  source: 'gong' | 'granola';
  meetingDate: Date | string;
  calendarEventId?: string | null;
  // Include parsing data for consolidation
  painPoints?: string[] | null;
  goals?: string[] | null;
  riskAssessment?: unknown | null;
}

/**
 * Result of deduplication with metadata
 */
interface DeduplicationResult {
  uniqueMeetings: Meeting[];
  duplicatesRemoved: number;
  gongPrioritized: number; // How many times Gong was chosen over Granola
  matchedByCalendarId: number;
  matchedByTime: number;
}

/**
 * Checks if two meetings are duplicates based on:
 * 1. Calendar event ID (exact match)
 * 2. Meeting date/time (within 1-hour window)
 */
function areMeetingsDuplicate(m1: Meeting, m2: Meeting): boolean {
  // Match 1: Calendar event ID (exact match)
  if (m1.calendarEventId && m2.calendarEventId) {
    if (m1.calendarEventId === m2.calendarEventId) {
      return true;
    }
  }

  // Match 2: Meeting date/time (within 1-hour window = 3600000 ms)
  const date1 = new Date(m1.meetingDate).getTime();
  const date2 = new Date(m2.meetingDate).getTime();
  const timeDifference = Math.abs(date1 - date2);
  const oneHourInMs = 60 * 60 * 1000;

  return timeDifference <= oneHourInMs;
}

/**
 * Deduplicates meetings with Gong priority
 *
 * Algorithm:
 * 1. Sort all meetings by date (oldest first)
 * 2. For each meeting, check if it's a duplicate of any already-selected meeting
 * 3. If duplicate found:
 *    - If existing is Gong: skip current meeting
 *    - If existing is Granola and current is Gong: replace with Gong
 * 4. If not duplicate: add to unique list
 *
 * @param gongCalls - Array of parsed Gong calls
 * @param granolaNotes - Array of parsed Granola notes
 * @returns Deduplicated meetings with Gong prioritized
 */
export function deduplicateMeetings(
  gongCalls: Meeting[],
  granolaNotes: Meeting[]
): DeduplicationResult {
  const allMeetings = [
    ...gongCalls.map((call) => ({ ...call, source: 'gong' as const })),
    ...granolaNotes.map((note) => ({ ...note, source: 'granola' as const })),
  ];

  // Sort by meeting date (oldest first) for temporal analysis
  allMeetings.sort((a, b) => {
    return new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime();
  });

  const uniqueMeetings: Meeting[] = [];
  let duplicatesRemoved = 0;
  let gongPrioritized = 0;
  let matchedByCalendarId = 0;
  let matchedByTime = 0;

  for (const meeting of allMeetings) {
    // Check if this meeting is a duplicate of any already-selected meeting
    const duplicateIndex = uniqueMeetings.findIndex((existing) =>
      areMeetingsDuplicate(existing, meeting)
    );

    if (duplicateIndex === -1) {
      // Not a duplicate - add to unique list
      uniqueMeetings.push(meeting);
    } else {
      // Duplicate found
      duplicatesRemoved++;

      // Track match type (for logging)
      if (
        meeting.calendarEventId &&
        uniqueMeetings[duplicateIndex].calendarEventId &&
        meeting.calendarEventId === uniqueMeetings[duplicateIndex].calendarEventId
      ) {
        matchedByCalendarId++;
      } else {
        matchedByTime++;
      }

      const existingMeeting = uniqueMeetings[duplicateIndex];

      // Priority rule: Gong > Granola
      if (existingMeeting.source === 'gong') {
        // Keep Gong, skip current meeting
        continue;
      } else if (meeting.source === 'gong') {
        // Replace Granola with Gong
        uniqueMeetings[duplicateIndex] = meeting;
        gongPrioritized++;
      }
      // If both are Granola or both are Gong, keep the first one (already handled by continue)
    }
  }

  return {
    uniqueMeetings,
    duplicatesRemoved,
    gongPrioritized,
    matchedByCalendarId,
    matchedByTime,
  };
}

/**
 * Helper to log deduplication stats
 */
export function logDeduplicationStats(
  opportunityId: string,
  result: DeduplicationResult
): void {
  console.log(`[Deduplication] Opportunity ${opportunityId}:`, {
    totalMeetings: result.uniqueMeetings.length + result.duplicatesRemoved,
    uniqueMeetings: result.uniqueMeetings.length,
    duplicatesRemoved: result.duplicatesRemoved,
    gongPrioritized: result.gongPrioritized,
    matchedByCalendarId: result.matchedByCalendarId,
    matchedByTime: result.matchedByTime,
    sources: {
      gong: result.uniqueMeetings.filter((m) => m.source === 'gong').length,
      granola: result.uniqueMeetings.filter((m) => m.source === 'granola').length,
    },
  });
}
