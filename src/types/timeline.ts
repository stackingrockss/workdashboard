// Timeline event types for opportunity activity visualization

import type { GongCall, GranolaNote, NoteType, ParsingStatus } from "@prisma/client";

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
 * Union type for all timeline events
 */
export type TimelineEvent = GongCallTimelineEvent | GranolaTimelineEvent;

/**
 * Timeline filter options
 */
export type TimelineFilterType = "all" | "gong_calls" | "granola_notes";

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
