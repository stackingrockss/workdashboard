"use client";

// Individual meeting item in the vertical timeline
// Shows meeting title, date, status badges, and visual indicators

import { Badge } from "@/components/ui/badge";
import { Users, Link2, Lightbulb, Loader2 } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  eventHasInsights,
  eventHasRecording,
  eventIsParsing,
  getLinkedTranscriptType,
} from "@/types/activity";
import type { TimelineEvent } from "@/types/timeline";

interface MeetingTimelineItemProps {
  event: TimelineEvent;
  isSelected: boolean;
  isLast: boolean;
  onClick: () => void;
}

export function MeetingTimelineItem({
  event,
  isSelected,
  isLast,
  onClick,
}: MeetingTimelineItemProps) {
  const hasInsights = eventHasInsights(event);
  const hasRecording = eventHasRecording(event);
  const isParsing = eventIsParsing(event);
  const linkedType = getLinkedTranscriptType(event);

  // Determine dot color based on state
  const getDotClasses = () => {
    if (hasInsights) {
      return "bg-green-500 border-green-600";
    }
    if (isParsing) {
      return "bg-yellow-500 border-yellow-600 animate-pulse";
    }
    if (hasRecording) {
      return "bg-blue-500 border-blue-600";
    }
    return "bg-muted border-border";
  };

  // Badge classes for transcript type
  const getLinkedBadgeClasses = () => {
    if (linkedType === "gong" || linkedType === "both") {
      return "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400";
    }
    if (linkedType === "granola") {
      return "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400";
    }
    return "";
  };

  const linkedLabel = linkedType === "both" ? "Both" : linkedType === "gong" ? "Gong" : "Granola";

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all",
        "hover:bg-muted/50",
        isSelected && "bg-primary/10 ring-1 ring-primary"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-selected={isSelected}
    >
      {/* Timeline dot and connector */}
      <div className="relative flex-shrink-0 mt-1.5">
        <div
          className={cn(
            "w-3 h-3 rounded-full border-2",
            getDotClasses()
          )}
        />
        {/* Vertical line connector (hidden for last item) */}
        {!isLast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-0.5 h-[calc(100%+0.75rem)] bg-border" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{event.title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDateShort(event.date.toString())}
        </p>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {/* Attendee count */}
          {event.attendees && event.attendees.length > 0 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              <Users className="h-3 w-3 mr-1" />
              {event.attendees.length}
            </Badge>
          )}

          {/* Linked transcript type */}
          {linkedType && (
            <Badge
              variant="outline"
              className={cn("text-xs px-1.5 py-0", getLinkedBadgeClasses())}
            >
              <Link2 className="h-3 w-3 mr-1" />
              {linkedLabel}
            </Badge>
          )}

          {/* Parsing indicator */}
          {isParsing && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Parsing
            </Badge>
          )}

          {/* Has insights indicator */}
          {hasInsights && !isParsing && (
            <Badge
              variant="secondary"
              className="text-xs px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
            >
              <Lightbulb className="h-3 w-3" />
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
