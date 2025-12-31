/**
 * Hook for real-time token estimation during content generation
 *
 * Fetches token estimates from the API based on selected context
 * and provides formatted display values.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { ContextSelection } from "@/types/brief";
import { formatTokenCount, getTokenUsageColor } from "@/lib/ai/token-estimator";

export interface TokenEstimate {
  brief: {
    systemInstruction: number;
    outputFormat: number;
    sections: number;
    total: number;
  };
  context: {
    opportunity: number;
    account: number;
    contacts: number;
    consolidatedInsights: number;
    meetings: number;
    accountResearch: number;
    additionalContext: number;
    total: number;
  };
  meetings: Array<{
    id: string;
    title: string;
    type: "gong" | "granola" | "google";
    estimatedTokens: number;
    hasTranscript: boolean;
    transcriptLength?: number;
    insightsCount: number;
  }>;
  totalEstimated: number;
  totalFormatted: string;
  modelLimits: {
    model: string;
    inputLimit: number;
    inputLimitFormatted: string;
    outputLimit: number;
  };
  percentageOfLimit: number;
}

interface UseTokenEstimateOptions {
  opportunityId: string;
  briefId?: string;
  contextSelection: ContextSelection;
  debounceMs?: number;
}

interface UseTokenEstimateReturn {
  estimate: TokenEstimate | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  // Convenience getters
  totalTokens: number;
  totalFormatted: string;
  percentageOfLimit: number;
  usageColor: string;
  isNearLimit: boolean;
  meetingTokens: Map<string, number>;
}

export function useTokenEstimate({
  opportunityId,
  briefId,
  contextSelection,
  debounceMs = 300,
}: UseTokenEstimateOptions): UseTokenEstimateReturn {
  const [estimate, setEstimate] = useState<TokenEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build query string from context selection
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();

    if (briefId) {
      params.set("briefId", briefId);
    }

    if (contextSelection.gongCallIds.length > 0) {
      params.set("gongCallIds", contextSelection.gongCallIds.join(","));
    }

    if (contextSelection.granolaNoteIds.length > 0) {
      params.set("granolaNoteIds", contextSelection.granolaNoteIds.join(","));
    }

    if (contextSelection.googleNoteIds.length > 0) {
      params.set("googleNoteIds", contextSelection.googleNoteIds.join(","));
    }

    params.set(
      "includeConsolidatedInsights",
      String(contextSelection.includeConsolidatedInsights)
    );

    params.set(
      "includeAccountResearch",
      String(contextSelection.includeAccountResearch)
    );

    // Include meeting transcripts toggle (defaults to false)
    params.set(
      "includeMeetingTranscripts",
      String(contextSelection.includeMeetingTranscripts ?? false)
    );

    if (contextSelection.additionalContext) {
      params.set(
        "additionalContextLength",
        String(contextSelection.additionalContext.length)
      );
    }

    return params.toString();
  }, [briefId, contextSelection]);

  // Fetch estimate from API
  const fetchEstimate = useCallback(async () => {
    if (!opportunityId) return;

    setLoading(true);
    setError(null);

    try {
      const queryString = buildQueryString();
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/estimate-tokens?${queryString}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch token estimate");
      }

      const data = await response.json();
      setEstimate(data.estimate);
    } catch (err) {
      console.error("Error fetching token estimate:", err);
      setError(err instanceof Error ? err.message : "Failed to estimate tokens");
    } finally {
      setLoading(false);
    }
  }, [opportunityId, buildQueryString]);

  // Debounced effect for fetching estimates
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchEstimate();
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [fetchEstimate, debounceMs]);

  // Build meeting tokens map for quick lookup
  const meetingTokens = useMemo(() => {
    const map = new Map<string, number>();
    if (estimate?.meetings) {
      for (const meeting of estimate.meetings) {
        map.set(meeting.id, meeting.estimatedTokens);
      }
    }
    return map;
  }, [estimate?.meetings]);

  // Computed values
  const totalTokens = estimate?.totalEstimated ?? 0;
  const totalFormatted = estimate?.totalFormatted ?? formatTokenCount(0);
  const percentageOfLimit = estimate?.percentageOfLimit ?? 0;
  const usageColor = getTokenUsageColor(percentageOfLimit);
  const isNearLimit = percentageOfLimit >= 50;

  return {
    estimate,
    loading,
    error,
    refetch: fetchEstimate,
    totalTokens,
    totalFormatted,
    percentageOfLimit,
    usageColor,
    isNearLimit,
    meetingTokens,
  };
}

/**
 * Hook for getting token estimate for a single meeting
 * (client-side estimation without API call)
 */
export function useQuickMeetingTokenEstimate(meeting: {
  type: "gong" | "granola" | "google";
  isParsed?: boolean;
  insights?: {
    painPoints: number;
    goals: number;
    nextSteps: number;
  };
}): { estimatedTokens: number; formatted: string } {
  const estimatedTokens = useMemo(() => {
    // Base tokens for meeting header and metadata
    let tokens = 50;

    // Add tokens for insights if parsed
    if (meeting.isParsed && meeting.insights) {
      const insightCount =
        meeting.insights.painPoints +
        meeting.insights.goals +
        meeting.insights.nextSteps;
      // Estimate ~20 tokens per insight
      tokens += insightCount * 20;
    }

    // Add estimated transcript tokens based on type
    // Gong and Granola typically have transcripts
    if (meeting.type === "gong" || meeting.type === "granola") {
      // Assume average transcript of ~3000 chars if parsed
      if (meeting.isParsed) {
        tokens += 750; // ~3000 chars / 4 chars per token
      }
    }

    return tokens;
  }, [meeting]);

  return {
    estimatedTokens,
    formatted: formatTokenCount(estimatedTokens),
  };
}
