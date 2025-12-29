"use client";

/**
 * Notes Tab Component
 *
 * A unified rich text editor for opportunity notes that combines:
 * - User's personal notes
 * - AI-generated consolidated insights from call transcripts
 *
 * AI insights are automatically merged into the notes when available,
 * preserving all user edits by prepending new content.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StickyNote, Sparkles, RefreshCw } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { toast } from "sonner";
import {
  insightsToMarkdown,
  mergeInsightsIntoNotes,
  notesContainInsights,
  hasConsolidatedInsights,
  extractInsightsData,
} from "@/lib/utils/insights-to-markdown";
import type { RiskAssessment } from "@/types/gong-call";

// ============================================================================
// Types
// ============================================================================

interface NotesTabProps {
  opportunity: {
    id: string;
    notes?: string | null;
    // Consolidated insights
    consolidatedPainPoints?: unknown;
    consolidatedGoals?: unknown;
    consolidatedRiskAssessment?: RiskAssessment | null;
    consolidatedWhyAndWhyNow?: unknown;
    consolidatedMetrics?: unknown;
    lastConsolidatedAt?: Date | string | null;
    consolidationCallCount?: number | null;
  };
  onFieldUpdate: (
    field: keyof OpportunityUpdateInput,
    value: string | number | null
  ) => Promise<void>;
  onReconsolidate: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function NotesTab({
  opportunity,
  onFieldUpdate,
  onReconsolidate,
}: NotesTabProps) {
  const [notesContent, setNotesContent] = useState(opportunity.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if insights are available and if they're already in the notes
  const insightsAvailable = hasConsolidatedInsights(opportunity);
  const insightsInNotes = notesContainInsights(notesContent);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Track the original notes to avoid unnecessary saves
  const originalNotesRef = useRef(opportunity.notes || "");

  // Handle notes change with debounce
  const handleNotesChange = useCallback(
    (content: string) => {
      setNotesContent(content);

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Don't save if content hasn't actually changed from original
      if (content === originalNotesRef.current) {
        return;
      }

      // Debounce the save (1.5 seconds)
      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await onFieldUpdate("notes", content || null);
          setLastSaved(new Date());
          // Update the original ref after successful save
          originalNotesRef.current = content;
        } finally {
          setIsSaving(false);
        }
      }, 1500);
    },
    [onFieldUpdate]
  );

  // Add AI insights to notes
  const handleAddInsights = useCallback(async () => {
    const insightsData = extractInsightsData(opportunity);
    if (!insightsData) {
      toast.error("No insights available to add");
      return;
    }

    setIsMerging(true);
    try {
      const insightsMarkdown = insightsToMarkdown(insightsData);
      const mergedNotes = mergeInsightsIntoNotes(insightsMarkdown, notesContent);

      setNotesContent(mergedNotes);
      await onFieldUpdate("notes", mergedNotes);
      setLastSaved(new Date());
      toast.success("AI insights added to notes");
    } catch (error) {
      console.error("Failed to add insights:", error);
      toast.error("Failed to add insights");
    } finally {
      setIsMerging(false);
    }
  }, [opportunity, notesContent, onFieldUpdate]);

  // Refresh insights (re-consolidate and add new insights)
  const handleRefreshInsights = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Trigger re-consolidation
      const res = await fetch(
        `/api/v1/opportunities/${opportunity.id}/consolidate-insights`,
        { method: "POST" }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to trigger consolidation");
      }

      toast.success("Refreshing insights... This may take a moment.");
      onReconsolidate();
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh insights"
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [opportunity.id, onReconsolidate]);

  return (
    <div className="space-y-4">
      {/* Single RTF Editor Card */}
      <Card className="border-2 border-primary/10 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <StickyNote className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Notes & Insights</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Editable notes with AI-generated insights from call transcripts
                </p>
              </div>
            </div>

            {/* Action buttons and save status */}
            <div className="flex items-center gap-2">
              {/* Add Insights button - shown when insights available but not in notes */}
              {insightsAvailable && !insightsInNotes && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddInsights}
                  disabled={isMerging}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isMerging ? "Adding..." : "Add AI Insights"}
                </Button>
              )}

              {/* Refresh Insights button - shown when insights already in notes */}
              {insightsAvailable && insightsInNotes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshInsights}
                  disabled={isRefreshing}
                  className="gap-1.5"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  {isRefreshing ? "Refreshing..." : "Refresh Insights"}
                </Button>
              )}

              {/* Save status indicator */}
              {isSaving && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
                  Saving...
                </Badge>
              )}
              {lastSaved && !isSaving && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Saved
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <RichTextEditor
            content={notesContent}
            onChange={handleNotesChange}
            placeholder="Start typing your notes here... AI insights from call transcripts will appear when available."
            className="min-h-[400px]"
            editorClassName="min-h-[350px]"
            enableAI={true}
            opportunityId={opportunity.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
