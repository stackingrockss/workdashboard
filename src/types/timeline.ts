// Timeline event types for opportunity activity visualization

import type { GongCall, GranolaNote, CalendarEvent, CalendarEventSource, NoteType, ParsingStatus, Prisma } from "@prisma/client";

/**
 * Summary of a linked transcript (Gong call or Granola note) for calendar events
 */
export interface LinkedTranscriptSummary {
  id: string;
  title: string;
  parsingStatus: ParsingStatus | null;
  hasInsights: boolean;
}

/**
 * Calendar event for pre-selection when adding Gong/Granola
 */
export interface PreselectedCalendarEvent {
  id: string;
  title: string;
  startTime: Date | string;
}

/**
 * Base timeline event with common fields
 */
export interface BaseTimelineEvent {
  id: string;
  date: Date;
  title: string;
}

/**
 * Gong call timeline event
 */
export interface GongCallTimelineEvent extends BaseTimelineEvent {
  type: "gong_call";
  url: string;
  noteType: NoteType | null;
  parsingStatus: ParsingStatus | null;
  painPoints: unknown;
  goals: unknown;
  nextSteps: unknown;
  riskAssessment: unknown;
  parsedPeople: unknown;
  whyAndWhyNow: unknown;
  quantifiableMetrics: unknown;
}

/**
 * Granola note timeline event
 */
export interface GranolaTimelineEvent extends BaseTimelineEvent {
  type: "granola_note";
  url: string;
  noteType: NoteType | null;
}

/**
 * Calendar event timeline event
 */
export interface CalendarEventTimelineEvent extends BaseTimelineEvent {
  type: "calendar_event";
  description: string | null;
  meetingUrl: string | null;
  source: CalendarEventSource;
  attendees: string[];
  // Linked transcript info (populated when calendar event has associated Gong/Granola)
  linkedGongCall?: LinkedTranscriptSummary | null;
  linkedGranolaNote?: LinkedTranscriptSummary | null;
}

/**
 * Union type for all timeline events
 */
export type TimelineEvent = GongCallTimelineEvent | GranolaTimelineEvent | CalendarEventTimelineEvent;

/**
 * Timeline filter options
 */
export type TimelineFilterType = "all" | "gong_calls" | "granola_notes" | "calendar_events";

export type TimelineDateRange = "30" | "60" | "90" | "all";

/**
 * Helper to convert Gong call to timeline event
 */
export function gongCallToTimelineEvent(call: GongCall): GongCallTimelineEvent {
  return {
    id: call.id,
    type: "gong_call",
    date: call.meetingDate,
    title: call.title,
    url: call.url,
    noteType: call.noteType,
    parsingStatus: call.parsingStatus,
    painPoints: call.painPoints,
    goals: call.goals,
    nextSteps: call.nextSteps,
    riskAssessment: call.riskAssessment,
    parsedPeople: call.parsedPeople,
    whyAndWhyNow: call.whyAndWhyNow,
    quantifiableMetrics: call.quantifiableMetrics,
  };
}

/**
 * Helper to convert Granola note to timeline event
 */
export function granolaToTimelineEvent(note: GranolaNote): GranolaTimelineEvent {
  return {
    id: note.id,
    type: "granola_note",
    date: note.meetingDate,
    title: note.title,
    url: note.url,
    noteType: note.noteType,
  };
}

/**
 * Type for calendar event with included linked transcripts from Prisma
 */
export type CalendarEventWithLinks = CalendarEvent & {
  gongCalls?: Array<{
    id: string;
    title: string;
    parsingStatus: ParsingStatus | null;
    painPoints: Prisma.JsonValue;
    goals: Prisma.JsonValue;
    nextSteps: Prisma.JsonValue;
  }>;
  granolaNotes?: Array<{
    id: string;
    title: string;
    parsingStatus: ParsingStatus | null;
    painPoints: Prisma.JsonValue;
    goals: Prisma.JsonValue;
    nextSteps: Prisma.JsonValue;
  }>;
};

/**
 * Helper to check if a transcript has parsed insights
 */
function hasTranscriptInsights(transcript: {
  painPoints: Prisma.JsonValue;
  goals: Prisma.JsonValue;
  nextSteps: Prisma.JsonValue;
}): boolean {
  const painPoints = Array.isArray(transcript.painPoints) ? transcript.painPoints : [];
  const goals = Array.isArray(transcript.goals) ? transcript.goals : [];
  const nextSteps = Array.isArray(transcript.nextSteps) ? transcript.nextSteps : [];
  return painPoints.length > 0 || goals.length > 0 || nextSteps.length > 0;
}

/**
 * Helper to convert Calendar event to timeline event (without linked transcripts)
 */
export function calendarEventToTimelineEvent(event: CalendarEvent): CalendarEventTimelineEvent {
  return {
    id: event.id,
    type: "calendar_event",
    date: event.startTime,
    title: event.summary,
    description: event.description,
    meetingUrl: event.meetingUrl,
    source: event.source,
    attendees: event.attendees,
    linkedGongCall: null,
    linkedGranolaNote: null,
  };
}

/**
 * Helper to convert Calendar event with linked transcripts to timeline event
 */
export function calendarEventWithLinksToTimelineEvent(
  event: CalendarEventWithLinks
): CalendarEventTimelineEvent {
  const linkedGong = event.gongCalls?.[0];
  const linkedGranola = event.granolaNotes?.[0];

  return {
    id: event.id,
    type: "calendar_event",
    date: event.startTime,
    title: event.summary,
    description: event.description,
    meetingUrl: event.meetingUrl,
    source: event.source,
    attendees: event.attendees,
    linkedGongCall: linkedGong
      ? {
          id: linkedGong.id,
          title: linkedGong.title,
          parsingStatus: linkedGong.parsingStatus,
          hasInsights: hasTranscriptInsights(linkedGong),
        }
      : null,
    linkedGranolaNote: linkedGranola
      ? {
          id: linkedGranola.id,
          title: linkedGranola.title,
          parsingStatus: linkedGranola.parsingStatus,
          hasInsights: hasTranscriptInsights(linkedGranola),
        }
      : null,
  };
}

/**
 * Sort timeline events by date (most recent first)
 */
export function sortTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  return events.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Group timeline events by month
 */
export function groupEventsByMonth(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();

  events.forEach((event) => {
    const monthKey = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
    }).format(event.date);

    if (!groups.has(monthKey)) {
      groups.set(monthKey, []);
    }
    groups.get(monthKey)!.push(event);
  });

  return groups;
}
