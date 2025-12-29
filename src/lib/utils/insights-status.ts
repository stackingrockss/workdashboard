/**
 * Utility functions for calculating AI insights status
 * Determines what insights have been consolidated and what new calls are available
 */

import type { GongCall } from "@/types/gong-call";
import type { GranolaNote } from "@/types/granola-note";

// ============================================================================
// Types
// ============================================================================

export interface ParsedCallInfo {
  id: string;
  title: string;
  parsedAt: Date | null;
  meetingDate: Date | null;
  source: "gong" | "granola";
}

export interface NewInsightsPreview {
  painPointsCount: number;
  goalsCount: number;
  nextStepsCount: number;
}

export type InsightsState =
  | "none" // No calls/notes exist
  | "pending" // Calls exist but none are parsed yet
  | "ready" // Parsed calls exist, but not yet consolidated into notes
  | "applied" // Insights have been consolidated and are up to date
  | "applied_with_new"; // Insights applied, but new parsed calls available

export interface InsightsStatus {
  state: InsightsState;
  lastConsolidatedAt: Date | null;
  consolidatedCount: number;

  // Call breakdowns
  consolidatedCalls: ParsedCallInfo[]; // Calls included in last consolidation
  newParsedCalls: ParsedCallInfo[]; // Parsed after lastConsolidatedAt
  pendingCalls: ParsedCallInfo[]; // Not yet parsed (parsingStatus !== 'completed')

  // Preview of what new insights would add
  newInsightsPreview: NewInsightsPreview | null;

  // Total counts for display
  totalParsedCount: number;
  totalCallCount: number;
}

interface OpportunityInsightsData {
  lastConsolidatedAt?: Date | string | null;
  consolidationCallCount?: number | null;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Calculate the current state of AI insights for an opportunity
 */
export function getInsightsStatus(
  opportunity: OpportunityInsightsData,
  gongCalls: GongCall[],
  granolaNotes: GranolaNote[]
): InsightsStatus {
  const lastConsolidatedAt = opportunity.lastConsolidatedAt
    ? new Date(opportunity.lastConsolidatedAt)
    : null;
  const consolidatedCount = opportunity.consolidationCallCount ?? 0;

  // Convert calls to unified format
  const allCalls: ParsedCallInfo[] = [
    ...gongCalls.map((c) => ({
      id: c.id,
      title: c.title,
      parsedAt: c.parsedAt ? new Date(c.parsedAt) : null,
      meetingDate: c.meetingDate ? new Date(c.meetingDate) : null,
      source: "gong" as const,
    })),
    ...granolaNotes.map((n) => ({
      id: n.id,
      title: n.title,
      parsedAt: n.parsedAt ? new Date(n.parsedAt) : null,
      meetingDate: n.meetingDate ? new Date(n.meetingDate) : null,
      source: "granola" as const,
    })),
  ];

  // Sort by meeting date descending
  allCalls.sort((a, b) => {
    const dateA = a.meetingDate?.getTime() ?? 0;
    const dateB = b.meetingDate?.getTime() ?? 0;
    return dateB - dateA;
  });

  // Categorize calls
  const parsedCalls = allCalls.filter((c) => c.parsedAt !== null);
  const pendingCalls = allCalls.filter((c) => c.parsedAt === null);

  // Determine which parsed calls are new (parsed after last consolidation)
  let consolidatedCalls: ParsedCallInfo[] = [];
  let newParsedCalls: ParsedCallInfo[] = [];

  if (lastConsolidatedAt) {
    consolidatedCalls = parsedCalls.filter(
      (c) => c.parsedAt && c.parsedAt <= lastConsolidatedAt
    );
    newParsedCalls = parsedCalls.filter(
      (c) => c.parsedAt && c.parsedAt > lastConsolidatedAt
    );
  } else {
    // No consolidation yet - all parsed calls are "new"
    newParsedCalls = parsedCalls;
  }

  // Calculate preview of new insights
  const newInsightsPreview = calculateNewInsightsPreview(
    newParsedCalls,
    gongCalls,
    granolaNotes
  );

  // Determine state
  const state = determineState({
    totalCalls: allCalls.length,
    parsedCount: parsedCalls.length,
    pendingCount: pendingCalls.length,
    consolidatedCount,
    newParsedCount: newParsedCalls.length,
    hasConsolidation: lastConsolidatedAt !== null,
  });

  return {
    state,
    lastConsolidatedAt,
    consolidatedCount,
    consolidatedCalls,
    newParsedCalls,
    pendingCalls,
    newInsightsPreview,
    totalParsedCount: parsedCalls.length,
    totalCallCount: allCalls.length,
  };
}

// ============================================================================
// Helpers
// ============================================================================

interface StateInput {
  totalCalls: number;
  parsedCount: number;
  pendingCount: number;
  consolidatedCount: number;
  newParsedCount: number;
  hasConsolidation: boolean;
}

function determineState(input: StateInput): InsightsState {
  const { totalCalls, parsedCount, pendingCount, hasConsolidation, newParsedCount } =
    input;

  // No calls at all
  if (totalCalls === 0) {
    return "none";
  }

  // All calls are pending (none parsed)
  if (parsedCount === 0 && pendingCount > 0) {
    return "pending";
  }

  // Has parsed calls but no consolidation yet
  if (parsedCount > 0 && !hasConsolidation) {
    return "ready";
  }

  // Has consolidation and new parsed calls available
  if (hasConsolidation && newParsedCount > 0) {
    return "applied_with_new";
  }

  // Has consolidation and everything is up to date
  if (hasConsolidation) {
    return "applied";
  }

  // Fallback (shouldn't reach here)
  return "none";
}

function calculateNewInsightsPreview(
  newParsedCalls: ParsedCallInfo[],
  gongCalls: GongCall[],
  granolaNotes: GranolaNote[]
): NewInsightsPreview | null {
  if (newParsedCalls.length === 0) {
    return null;
  }

  let painPointsCount = 0;
  let goalsCount = 0;
  let nextStepsCount = 0;

  for (const call of newParsedCalls) {
    if (call.source === "gong") {
      const gongCall = gongCalls.find((c) => c.id === call.id);
      if (gongCall) {
        painPointsCount += gongCall.painPoints?.length ?? 0;
        goalsCount += gongCall.goals?.length ?? 0;
        nextStepsCount += gongCall.nextSteps?.length ?? 0;
      }
    } else {
      const granolaNote = granolaNotes.find((n) => n.id === call.id);
      if (granolaNote) {
        painPointsCount += granolaNote.painPoints?.length ?? 0;
        goalsCount += granolaNote.goals?.length ?? 0;
        nextStepsCount += granolaNote.nextSteps?.length ?? 0;
      }
    }
  }

  return {
    painPointsCount,
    goalsCount,
    nextStepsCount,
  };
}
