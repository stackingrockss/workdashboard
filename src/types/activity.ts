// Extended types for Activity tab redesign
// Aggregation, filtering, and UI state types

import type { TimelineEvent, TimelineDateRange } from "./timeline";

/**
 * Individual insight item with mention tracking
 */
export interface AggregatedInsightItem {
  text: string;
  mentionCount: number;
  sources: {
    meetingId: string;
    meetingTitle: string;
    meetingDate: Date;
    transcriptType: "gong" | "granola";
  }[];
}

/**
 * Aggregated insights across all parsed calls for an opportunity
 */
export interface AggregatedInsights {
  totalMeetings: number;
  parsedCallsCount: number;
  totalInsightsCount: number;
  painPoints: AggregatedInsightItem[];
  goals: AggregatedInsightItem[];
  nextSteps: AggregatedInsightItem[];
}

/**
 * Filter state for activity tab
 */
export interface ActivityFilters {
  dateRange: TimelineDateRange;
  hasInsights: boolean | null;
  hasRecording: boolean | null;
  searchQuery: string;
}

/**
 * Default filter values
 */
export const defaultActivityFilters: ActivityFilters = {
  dateRange: "all",
  hasInsights: null,
  hasRecording: null,
  searchQuery: "",
};

/**
 * Check if an event has any linked transcript
 */
export function eventHasRecording(event: TimelineEvent): boolean {
  return !!(event.linkedGongCall || event.linkedGranolaNote);
}

/**
 * Check if an event has parsed insights
 */
export function eventHasInsights(event: TimelineEvent): boolean {
  const gongHasInsights = event.linkedGongCall?.hasInsights ?? false;
  const granolaHasInsights = event.linkedGranolaNote?.hasInsights ?? false;
  return gongHasInsights || granolaHasInsights;
}

/**
 * Check if an event has a transcript that is currently parsing
 */
export function eventIsParsing(event: TimelineEvent): boolean {
  const gongParsing = event.linkedGongCall?.parsingStatus === "parsing";
  const granolaParsing = event.linkedGranolaNote?.parsingStatus === "parsing";
  return gongParsing || granolaParsing;
}

/**
 * Get the linked transcript type for display
 */
export function getLinkedTranscriptType(
  event: TimelineEvent
): "gong" | "granola" | "both" | null {
  const hasGong = !!event.linkedGongCall;
  const hasGranola = !!event.linkedGranolaNote;

  if (hasGong && hasGranola) return "both";
  if (hasGong) return "gong";
  if (hasGranola) return "granola";
  return null;
}
