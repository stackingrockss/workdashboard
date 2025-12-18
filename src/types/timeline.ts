// Timeline event types for opportunity activity visualization
// Timeline now shows only calendar events, with Gong/Granola as linked content

import type { CalendarEvent, CalendarEventSource, ParsingStatus, Prisma } from "@prisma/client";

/**
 * Summary of a linked transcript (Gong call or Granola note) for calendar events
 * Includes parsed insights data for inline display
 */
export interface LinkedTranscriptSummary {
  id: string;
  title: string;
  url: string;
  parsingStatus: ParsingStatus | null;
  hasInsights: boolean;
  painPoints: string[];
  goals: string[];
  nextSteps: string[];
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
 * Calendar event timeline event (the only timeline event type)
 */
export interface CalendarEventTimelineEvent {
  id: string;
  type: "calendar_event";
  date: Date;
  title: string;
  description: string | null;
  meetingUrl: string | null;
  source: CalendarEventSource;
  attendees: string[];
  // Linked transcript info (populated when calendar event has associated Gong/Granola)
  linkedGongCall?: LinkedTranscriptSummary | null;
  linkedGranolaNote?: LinkedTranscriptSummary | null;
}

/**
 * Timeline event type (now only calendar events)
 */
export type TimelineEvent = CalendarEventTimelineEvent;

/**
 * Timeline date range filter options
 */
export type TimelineDateRange = "30" | "60" | "90" | "all";

/**
 * Type for calendar event with included linked transcripts from Prisma
 */
export type CalendarEventWithLinks = CalendarEvent & {
  gongCalls?: Array<{
    id: string;
    title: string;
    url: string;
    parsingStatus: ParsingStatus | null;
    painPoints: Prisma.JsonValue;
    goals: Prisma.JsonValue;
    nextSteps: Prisma.JsonValue;
  }>;
  granolaNotes?: Array<{
    id: string;
    title: string;
    url: string;
    parsingStatus: ParsingStatus | null;
    painPoints: Prisma.JsonValue;
    goals: Prisma.JsonValue;
    nextSteps: Prisma.JsonValue;
  }>;
};

/**
 * Helper to safely extract string array from JsonValue
 */
function extractStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Helper to check if a transcript has parsed insights
 */
function hasTranscriptInsights(transcript: {
  painPoints: Prisma.JsonValue;
  goals: Prisma.JsonValue;
  nextSteps: Prisma.JsonValue;
}): boolean {
  const painPoints = extractStringArray(transcript.painPoints);
  const goals = extractStringArray(transcript.goals);
  const nextSteps = extractStringArray(transcript.nextSteps);
  return painPoints.length > 0 || goals.length > 0 || nextSteps.length > 0;
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
          url: linkedGong.url,
          parsingStatus: linkedGong.parsingStatus,
          hasInsights: hasTranscriptInsights(linkedGong),
          painPoints: extractStringArray(linkedGong.painPoints),
          goals: extractStringArray(linkedGong.goals),
          nextSteps: extractStringArray(linkedGong.nextSteps),
        }
      : null,
    linkedGranolaNote: linkedGranola
      ? {
          id: linkedGranola.id,
          title: linkedGranola.title,
          url: linkedGranola.url,
          parsingStatus: linkedGranola.parsingStatus,
          hasInsights: hasTranscriptInsights(linkedGranola),
          painPoints: extractStringArray(linkedGranola.painPoints),
          goals: extractStringArray(linkedGranola.goals),
          nextSteps: extractStringArray(linkedGranola.nextSteps),
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
