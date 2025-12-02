"use client";

// Individual node on the horizontal timeline
// Displays meeting title, date, and parsing status badge

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, StickyNote, Loader2, Check, X } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import type { TimelineEvent } from "@/types/timeline";
import { cn } from "@/lib/utils";

interface TimelineNodeProps {
  event: TimelineEvent;
  isSelected: boolean;
  onClick: () => void;
}

export function TimelineNode({ event, isSelected, onClick }: TimelineNodeProps) {
  const isGongCall = event.type === "gong_call";

  // Type-specific styling
  const iconBgColor = isGongCall
    ? "bg-blue-100 dark:bg-blue-900"
    : "bg-green-100 dark:bg-green-900";
  const iconColor = isGongCall
    ? "text-blue-600 dark:text-blue-400"
    : "text-green-600 dark:text-green-400";

  // Get parsing status for Gong calls
  const parsingStatus = isGongCall ? event.parsingStatus : null;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Card */}
      <Card
        className={cn(
          "w-[160px] p-3 cursor-pointer transition-all hover:shadow-md",
          isSelected && "ring-2 ring-primary shadow-md"
        )}
        onClick={onClick}
      >
        <div className="space-y-2">
          {/* Icon and type indicator */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                iconBgColor,
                iconColor
              )}
            >
              {isGongCall ? (
                <Phone className="h-3.5 w-3.5" />
              ) : (
                <StickyNote className="h-3.5 w-3.5" />
              )}
            </div>

            {/* Parsing status badge */}
            {parsingStatus && (
              <Badge
                variant={
                  parsingStatus === "completed"
                    ? "default"
                    : parsingStatus === "failed"
                    ? "destructive"
                    : "secondary"
                }
                className="text-[10px] px-1.5 py-0"
              >
                {parsingStatus === "parsing" ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : parsingStatus === "completed" ? (
                  <Check className="h-2.5 w-2.5" />
                ) : parsingStatus === "failed" ? (
                  <X className="h-2.5 w-2.5" />
                ) : null}
              </Badge>
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
