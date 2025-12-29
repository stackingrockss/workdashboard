"use client";

/**
 * Notes Tab Component
 *
 * A unified rich text editor for opportunity notes that combines:
 * - User's personal notes
 * - AI-generated consolidated insights from call transcripts
 *
 * Features:
 * - InsightsStatusCard shows current state of AI insights
 * - Progressive disclosure: compact view with expandable details
 * - Preview of new insights before pulling them in
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StickyNote } from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { toast } from "sonner";
import {
  insightsToMarkdown,
  mergeInsightsIntoNotes,
  notesContainInsights,
  extractInsightsData,
} from "@/lib/utils/insights-to-markdown";
import { getInsightsStatus } from "@/lib/utils/insights-status";
import { InsightsStatusCard } from "./insights-status-card";
import type { RiskAssessment } from "@/types/gong-call";
import type { GongCall } from "@/types/gong-call";
import type { GranolaNote } from "@/types/granola-note";

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
  gongCalls: GongCall[];
  granolaNotes: GranolaNote[];
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
  gongCalls,
  granolaNotes,
  onFieldUpdate,
  onReconsolidate,
}: NotesTabProps) {
  const [notesContent, setNotesContent] = useState(opportunity.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate insights status
  const insightsStatus = useMemo(
    () => getInsightsStatus(opportunity, gongCalls, granolaNotes),
    [opportunity, gongCalls, granolaNotes]
  );

  // Check if insights are already in the notes
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
      {/* AI Insights Status Card */}
      <InsightsStatusCard
        status={insightsStatus}
        notesContainInsights={insightsInNotes}
        onAddInsights={handleAddInsights}
        onRefreshInsights={handleRefreshInsights}
        isAddingInsights={isMerging}
        isRefreshingInsights={isRefreshing}
      />

      {/* Notes Editor Card */}
      <Card className="border-2 border-primary/10 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <StickyNote className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Notes</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Your notes and AI-generated insights
                </p>
              </div>
            </div>

            {/* Save status indicator */}
            <div className="flex items-center gap-2">
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
