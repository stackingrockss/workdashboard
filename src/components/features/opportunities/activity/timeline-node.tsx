"use client";

// Individual node on the horizontal timeline
// Displays meeting title, date, and linked transcript indicator

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Link2 } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import type { TimelineEvent } from "@/types/timeline";
import { cn } from "@/lib/utils";

interface TimelineNodeProps {
  event: TimelineEvent;
  isSelected: boolean;
  position?: 'top' | 'bottom';
  onClick: () => void;
}

export function TimelineNode({ event, isSelected, position = 'bottom', onClick }: TimelineNodeProps) {
  // Check if calendar event has linked transcript
  const hasLinkedTranscript = event.linkedGongCall || event.linkedGranolaNote;

  const linkedType = event.linkedGongCall
    ? "Gong"
    : event.linkedGranolaNote
    ? "Granola"
    : null;

  return (
    <div className={cn(
      "flex items-center gap-2",
      position === 'top' ? "flex-col-reverse" : "flex-col"
    )}>
      {/* Card */}
      <Card
        className={cn(
          "w-[160px] p-3 cursor-pointer transition-all hover:shadow-md",
          isSelected && "ring-2 ring-primary shadow-md"
        )}
        onClick={onClick}
      >
        <div className="space-y-2">
          {/* Icon and linked indicator */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400">
              <Calendar className="h-3.5 w-3.5" />
            </div>

            {/* Linked transcript indicator */}
            {hasLinkedTranscript && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        linkedType === "Gong"
                          ? "border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400"
                          : "border-green-300 bg-green-50 text-green-600 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
                      )}
                    >
                      <Link2 className="h-2.5 w-2.5" />
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Linked to {linkedType}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Title */}
          <h4 className="text-xs font-medium leading-tight line-clamp-2">
            {event.title}
          </h4>

          {/* Date */}
          <p className="text-[10px] text-muted-foreground">
            {formatDateShort(event.date.toString())}
          </p>
        </div>
      </Card>

      {/* Connector dot to timeline */}
      <div className="w-3 h-3 rounded-full bg-border border-2 border-background" />
    </div>
  );
}
