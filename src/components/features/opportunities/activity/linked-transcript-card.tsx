"use client";

// Card component for displaying a linked Gong or Granola transcript
// Includes actions for unlinking and moving to another meeting

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  StickyNote,
  Link2,
  Loader2,
  MoreHorizontal,
  Unlink,
  ArrowRightLeft,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InsightsDisplay } from "./insights-display";
import { EditableInsightsDisplay } from "./editable-insights-display";
import type { LinkedTranscriptSummary, TimelineEvent } from "@/types/timeline";

interface LinkedTranscriptCardProps {
  transcript: LinkedTranscriptSummary;
  type: "gong" | "granola";
  opportunityId: string;
  calendarEventId: string;
  allEvents: TimelineEvent[];
  onRefresh: () => void;
  showInsights?: boolean;
}

export function LinkedTranscriptCard({
  transcript,
  type,
  opportunityId,
  calendarEventId,
  allEvents,
  onRefresh,
  showInsights = true,
}: LinkedTranscriptCardProps) {
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [movingToEventId, setMovingToEventId] = useState<string | null>(null);

  const isGong = type === "gong";
  const Icon = isGong ? Phone : StickyNote;
  const label = isGong ? "Gong Recording" : "Granola Note";
  const endpoint = isGong ? "gong-calls" : "granola-notes";

  const bgClasses = isGong
    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
    : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";

  const iconClasses = isGong
    ? "text-blue-600 dark:text-blue-400"
    : "text-green-600 dark:text-green-400";

  // Filter out current event from move options
  const otherEvents = allEvents.filter((e) => e.id !== calendarEventId);

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/${endpoint}/${transcript.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: null }),
        }
      );
      if (!response.ok) throw new Error("Failed to unlink");
      toast.success(`${label} unlinked from meeting`);
      onRefresh();
    } catch {
      toast.error(`Failed to unlink ${label.toLowerCase()}`);
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleMove = async (targetEventId: string) => {
    setMovingToEventId(targetEventId);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/${endpoint}/${transcript.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: targetEventId }),
        }
      );
      if (!response.ok) throw new Error("Failed to move");
      toast.success(`${label} moved to another meeting`);
      onRefresh();
    } catch {
      toast.error(`Failed to move ${label.toLowerCase()}`);
    } finally {
      setMovingToEventId(null);
    }
  };

  const renderParsingBadge = () => {
    if (!transcript.parsingStatus) return null;
    return (
      <Badge
        variant={
          transcript.parsingStatus === "completed"
            ? "secondary"
            : transcript.parsingStatus === "failed"
            ? "destructive"
            : "secondary"
        }
        className="text-xs"
      >
        {transcript.parsingStatus === "parsing" && (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        )}
        {transcript.parsingStatus}
      </Badge>
    );
  };

  return (
    <div className={cn("rounded-lg border p-3 space-y-2", bgClasses)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className={cn("h-4 w-4", iconClasses)} />
          <span className="text-sm font-medium">Linked {label}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={isUnlinking || !!movingToEventId}
            >
              {isUnlinking || movingToEventId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleUnlink}>
              <Unlink className="h-4 w-4 mr-2" />
              Unlink from Meeting
            </DropdownMenuItem>
            {otherEvents.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Move to...
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-[300px] overflow-y-auto">
                    {otherEvents.map((targetEvent) => (
                      <DropdownMenuItem
                        key={targetEvent.id}
                        onClick={() => handleMove(targetEvent.id)}
                      >
                        <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{targetEvent.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground flex-shrink-0">
                          {formatDateShort(targetEvent.date.toString())}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title and URL */}
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconClasses)} />
        <a
          href={transcript.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm hover:underline inline-flex items-center gap-1"
        >
          {transcript.title}
          <ExternalLink className="h-3 w-3" />
        </a>
        {renderParsingBadge()}
      </div>

      {/* Insights - Editable inline */}
      {showInsights && (
        <div className="pt-2 border-t border-dashed">
          <EditableInsightsDisplay
            transcriptId={transcript.id}
            transcriptType={type}
            opportunityId={opportunityId}
            painPoints={transcript.painPoints}
            goals={transcript.goals}
            nextSteps={transcript.nextSteps}
            onUpdate={onRefresh}
          />
        </div>
      )}
    </div>
  );
}

interface AddTranscriptButtonProps {
  type: "gong" | "granola";
  onAdd: () => void;
}

export function AddTranscriptButton({ type, onAdd }: AddTranscriptButtonProps) {
  const isGong = type === "gong";
  const Icon = isGong ? Phone : StickyNote;
  const label = isGong ? "Add Gong Recording" : "Add Granola Note";

  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3">
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Icon className="h-4 w-4 mr-2" />
        {label}
      </Button>
    </div>
  );
}
