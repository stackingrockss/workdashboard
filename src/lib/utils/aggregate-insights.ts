// Utility functions to aggregate insights across multiple calls
// Used by the Activity tab to show aggregated pain points, goals, and next steps

import type { TimelineEvent } from "@/types/timeline";
import type {
  AggregatedInsights,
  AggregatedInsightItem,
  ActivityFilters,
} from "@/types/activity";
import {
  eventHasRecording,
  eventHasInsights,
} from "@/types/activity";

/**
 * Normalize text for comparison (lowercase, trim, remove punctuation)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+$/, "");
}

/**
 * Check if two insight texts are similar enough to be grouped
 * Uses simple exact match after normalization for now
 */
function areSimilarInsights(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

/**
 * Aggregate insights of a specific type from all events
 */
function aggregateInsightType(
  events: TimelineEvent[],
  getInsights: (event: TimelineEvent) => { insights: string[]; type: "gong" | "granola" } | null
): AggregatedInsightItem[] {
  const insightMap = new Map<string, AggregatedInsightItem>();

  for (const event of events) {
    const result = getInsights(event);
    if (!result) continue;

    const { insights, type } = result;

    for (const insight of insights) {
      const normalized = normalizeText(insight);

      // Find existing similar insight or create new one
      let existingKey: string | null = null;
      for (const [key] of insightMap) {
        if (areSimilarInsights(key, normalized)) {
          existingKey = key;
          break;
        }
      }

      if (existingKey) {
        const existing = insightMap.get(existingKey)!;
        // Check if this source is already tracked
        const sourceExists = existing.sources.some(
          (s) => s.meetingId === event.id
        );
        if (!sourceExists) {
          existing.mentionCount++;
          existing.sources.push({
            meetingId: event.id,
            meetingTitle: event.title,
            meetingDate: event.date,
            transcriptType: type,
          });
        }
      } else {
        insightMap.set(normalized, {
          text: insight, // Keep original casing
          mentionCount: 1,
          sources: [
            {
              meetingId: event.id,
              meetingTitle: event.title,
              meetingDate: event.date,
              transcriptType: type,
            },
          ],
        });
      }
    }
  }

  // Sort by mention count (descending), then alphabetically
  return Array.from(insightMap.values()).sort((a, b) => {
    if (b.mentionCount !== a.mentionCount) {
      return b.mentionCount - a.mentionCount;
    }
    return a.text.localeCompare(b.text);
  });
}

/**
 * Aggregate all insights from timeline events
 */
export function aggregateInsights(events: TimelineEvent[]): AggregatedInsights {
  // Count parsed calls (events with linked transcripts that have insights)
  const parsedCallsCount = events.filter((e) => {
    const gongParsed =
      e.linkedGongCall?.parsingStatus === "completed" ||
      e.linkedGongCall?.hasInsights;
    const granolaParsed =
      e.linkedGranolaNote?.parsingStatus === "completed" ||
      e.linkedGranolaNote?.hasInsights;
    return gongParsed || granolaParsed;
  }).length;

  // Aggregate pain points (prioritize Gong over Granola)
  const painPoints = aggregateInsightType(events, (event) => {
    if (event.linkedGongCall && event.linkedGongCall.painPoints.length > 0) {
      return { insights: event.linkedGongCall.painPoints, type: "gong" };
    }
    if (event.linkedGranolaNote && event.linkedGranolaNote.painPoints.length > 0) {
      return { insights: event.linkedGranolaNote.painPoints, type: "granola" };
    }
    return null;
  });

  // Aggregate goals
  const goals = aggregateInsightType(events, (event) => {
    if (event.linkedGongCall && event.linkedGongCall.goals.length > 0) {
      return { insights: event.linkedGongCall.goals, type: "gong" };
    }
    if (event.linkedGranolaNote && event.linkedGranolaNote.goals.length > 0) {
      return { insights: event.linkedGranolaNote.goals, type: "granola" };
    }
    return null;
  });

  // Aggregate next steps
  const nextSteps = aggregateInsightType(events, (event) => {
    if (event.linkedGongCall && event.linkedGongCall.nextSteps.length > 0) {
      return { insights: event.linkedGongCall.nextSteps, type: "gong" };
    }
    if (event.linkedGranolaNote && event.linkedGranolaNote.nextSteps.length > 0) {
      return { insights: event.linkedGranolaNote.nextSteps, type: "granola" };
    }
    return null;
  });

  const totalInsightsCount =
    painPoints.length + goals.length + nextSteps.length;

  return {
    totalMeetings: events.length,
    parsedCallsCount,
    totalInsightsCount,
    painPoints,
    goals,
    nextSteps,
  };
}

/**
 * Filter events based on activity filters
 */
export function filterEvents(
  events: TimelineEvent[],
  filters: ActivityFilters
): TimelineEvent[] {
  return events.filter((event) => {
    // Filter by hasRecording
    if (filters.hasRecording === true && !eventHasRecording(event)) {
      return false;
    }
    if (filters.hasRecording === false && eventHasRecording(event)) {
      return false;
    }

    // Filter by hasInsights
    if (filters.hasInsights === true && !eventHasInsights(event)) {
      return false;
    }
    if (filters.hasInsights === false && eventHasInsights(event)) {
      return false;
    }

    // Filter by search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase().trim();
      const titleMatch = event.title.toLowerCase().includes(query);
      const attendeeMatch = event.attendees.some((a) =>
        a.toLowerCase().includes(query)
      );
      if (!titleMatch && !attendeeMatch) {
        return false;
      }
    }

    return true;
  });
}
