"use client";

/**
 * InsightsStatusCard Component
 *
 * Displays the current state of AI insights for an opportunity:
 * - Shows compact status (applied date, call count, new calls available)
 * - Expands to show detailed call lists and insights preview
 * - Provides action buttons to add/refresh insights
 */

import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  AlertCircle,
  RefreshCw,
  Plus,
  AlertTriangle,
  Target,
  ListChecks,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InsightsStatus, ParsedCallInfo } from "@/lib/utils/insights-status";

// ============================================================================
// Types
// ============================================================================

interface InsightsStatusCardProps {
  status: InsightsStatus;
  notesContainInsights: boolean;
  onAddInsights: () => Promise<void>;
  onRefreshInsights: () => Promise<void>;
  isAddingInsights: boolean;
  isRefreshingInsights: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

function CallList({
  title,
  calls,
  emptyMessage,
}: {
  title: string;
  calls: ParsedCallInfo[];
  emptyMessage?: string;
}) {
  if (calls.length === 0 && !emptyMessage) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {calls.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyMessage}</p>
      ) : (
        <ul className="space-y-0.5">
          {calls.map((call) => (
            <li
              key={call.id}
              className="flex items-center gap-2 text-xs text-foreground"
            >
              <span className="text-muted-foreground">•</span>
              <span className="truncate flex-1">{call.title}</span>
              {call.meetingDate && (
                <span className="text-muted-foreground text-[10px]">
                  {formatDateShort(call.meetingDate.toISOString())}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InsightsPreview({
  preview,
}: {
  preview: { painPointsCount: number; goalsCount: number; nextStepsCount: number };
}) {
  const hasAny =
    preview.painPointsCount > 0 ||
    preview.goalsCount > 0 ||
    preview.nextStepsCount > 0;

  if (!hasAny) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No new insights extracted from these calls yet.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {preview.painPointsCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <AlertTriangle className="h-3 w-3 text-orange-500" />
          <span className="text-muted-foreground">Pain Points:</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            +{preview.painPointsCount}
          </Badge>
        </div>
      )}
      {preview.goalsCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <Target className="h-3 w-3 text-blue-500" />
          <span className="text-muted-foreground">Goals:</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            +{preview.goalsCount}
          </Badge>
        </div>
      )}
      {preview.nextStepsCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <ListChecks className="h-3 w-3 text-green-500" />
          <span className="text-muted-foreground">Next Steps:</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            +{preview.nextStepsCount}
          </Badge>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function InsightsStatusCard({
  status,
  notesContainInsights,
  onAddInsights,
  onRefreshInsights,
  isAddingInsights,
  isRefreshingInsights,
}: InsightsStatusCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAddInsights = useCallback(async () => {
    await onAddInsights();
  }, [onAddInsights]);

  const handleRefreshInsights = useCallback(async () => {
    await onRefreshInsights();
  }, [onRefreshInsights]);

  // Render based on state
  return (
    <Card className="border-muted">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Compact Header - Always Visible */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Icon based on state */}
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  status.state === "none" && "bg-muted",
                  status.state === "pending" && "bg-yellow-500/10",
                  status.state === "ready" && "bg-blue-500/10",
                  status.state === "applied" && "bg-green-500/10",
                  status.state === "applied_with_new" && "bg-green-500/10"
                )}
              >
                {status.state === "none" && (
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                {status.state === "pending" && (
                  <Clock className="h-3.5 w-3.5 text-yellow-600" />
                )}
                {status.state === "ready" && (
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                )}
                {(status.state === "applied" ||
                  status.state === "applied_with_new") && (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                )}
              </div>

              {/* Status Text */}
              <div className="flex-1 min-w-0">
                <StatusText status={status} />
              </div>
            </div>

            {/* Action buttons and expand toggle */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Quick action buttons (visible in compact view) */}
              {status.state === "ready" && !notesContainInsights && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddInsights();
                  }}
                  disabled={isAddingInsights}
                  className="h-7 text-xs gap-1"
                >
                  {isAddingInsights ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add Insights
                </Button>
              )}

              {status.state === "applied_with_new" && (
                <Badge
                  variant="secondary"
                  className="bg-orange-500/10 text-orange-600 border-orange-200"
                >
                  {status.newParsedCalls.length} new
                </Badge>
              )}

              {/* Expand/collapse toggle */}
              {status.state !== "none" && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="border-t px-3 py-3 space-y-4 bg-muted/30">
            {/* Consolidated Calls */}
            {status.consolidatedCalls.length > 0 && (
              <CallList
                title="Consolidated Calls"
                calls={status.consolidatedCalls}
              />
            )}

            {/* New Parsed Calls */}
            {status.newParsedCalls.length > 0 && (
              <div className="space-y-2">
                <CallList
                  title="New Calls Ready"
                  calls={status.newParsedCalls}
                />
                {status.newInsightsPreview && (
                  <div className="pt-1">
                    <h4 className="text-xs font-medium text-muted-foreground mb-1.5">
                      Preview of New Insights
                    </h4>
                    <InsightsPreview preview={status.newInsightsPreview} />
                  </div>
                )}
              </div>
            )}

            {/* Pending Calls */}
            {status.pendingCalls.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-yellow-500" />
                <span>
                  {status.pendingCalls.length} call
                  {status.pendingCalls.length !== 1 ? "s" : ""} pending AI
                  analysis
                </span>
              </div>
            )}

            {/* Action Button */}
            <div className="flex justify-end pt-1">
              {status.state === "ready" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddInsights}
                  disabled={isAddingInsights}
                  className="gap-1.5"
                >
                  {isAddingInsights ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isAddingInsights ? "Adding..." : "Add AI Insights"}
                </Button>
              )}

              {status.state === "applied_with_new" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRefreshInsights}
                  disabled={isRefreshingInsights}
                  className="gap-1.5"
                >
                  {isRefreshingInsights ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {isRefreshingInsights ? "Refreshing..." : "Refresh Insights"}
                </Button>
              )}

              {status.state === "applied" &&
                status.totalParsedCount >= 2 &&
                notesContainInsights && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshInsights}
                    disabled={isRefreshingInsights}
                    className="gap-1.5 text-muted-foreground"
                  >
                    {isRefreshingInsights ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Re-consolidate
                  </Button>
                )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ============================================================================
// Status Text Component
// ============================================================================

function StatusText({ status }: { status: InsightsStatus }) {
  switch (status.state) {
    case "none":
      return (
        <p className="text-sm text-muted-foreground">
          No AI insights yet. Add a Gong call or Granola note with a transcript.
        </p>
      );

    case "pending":
      return (
        <p className="text-sm text-muted-foreground">
          <span className="text-yellow-600 font-medium">
            {status.pendingCalls.length} call
            {status.pendingCalls.length !== 1 ? "s" : ""}
          </span>{" "}
          pending AI analysis...
        </p>
      );

    case "ready":
      return (
        <p className="text-sm">
          <span className="text-blue-600 font-medium">
            {status.totalParsedCount} call
            {status.totalParsedCount !== 1 ? "s" : ""}
          </span>{" "}
          <span className="text-muted-foreground">ready for AI insights</span>
        </p>
      );

    case "applied":
      return (
        <p className="text-sm">
          <span className="text-green-600 font-medium">AI insights applied</span>
          {status.lastConsolidatedAt && (
            <span className="text-muted-foreground">
              {" "}
              {formatDateShort(status.lastConsolidatedAt.toISOString())} from{" "}
              {status.consolidatedCount} call
              {status.consolidatedCount !== 1 ? "s" : ""}
            </span>
          )}
        </p>
      );

    case "applied_with_new":
      return (
        <p className="text-sm">
          <span className="text-green-600 font-medium">AI insights applied</span>
          {status.lastConsolidatedAt && (
            <span className="text-muted-foreground">
              {" "}
              {formatDateShort(status.lastConsolidatedAt.toISOString())}
            </span>
          )}
          <span className="text-muted-foreground"> • </span>
          <span className="text-orange-600 font-medium">
            {status.newParsedCalls.length} new call
            {status.newParsedCalls.length !== 1 ? "s" : ""} available
          </span>
        </p>
      );

    default:
      return null;
  }
}
