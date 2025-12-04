"use client";

// Individual timeline event card component for calendar meetings
// Shows meeting details with linked transcript indicator

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Video, Link2 } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import type { TimelineEvent } from "@/types/timeline";

interface TimelineEventCardProps {
  event: TimelineEvent;
  position: "left" | "right";
  onViewInsights?: (callId: string) => void;
}

export function TimelineEventCard({
  event,
  position,
}: TimelineEventCardProps) {
  // Check for linked transcripts
  const hasLinkedGong = !!event.linkedGongCall;
  const hasLinkedGranola = !!event.linkedGranolaNote;
  const hasLinkedTranscript = hasLinkedGong || hasLinkedGranola;

  return (
    <div
      className={`flex items-center gap-4 ${
        position === "left" ? "flex-row" : "flex-row-reverse"
      }`}
    >
      {/* Timeline dot and icon */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400 z-10 relative">
          <Calendar className="h-5 w-5" />
        </div>
      </div>

      {/* Event card */}
      <Card
        className={`flex-1 p-4 hover:shadow-md transition-shadow ${
          position === "left" ? "mr-8" : "ml-8"
        }`}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-semibold text-base leading-tight">
                {event.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDateShort(event.date.toString())}
              </p>
            </div>

            {/* Linked transcript indicator */}
            {hasLinkedTranscript && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  hasLinkedGong
                    ? "border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400"
                    : "border-green-300 bg-green-50 text-green-600 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
                }`}
              >
                <Link2 className="h-3 w-3 mr-1" />
                {hasLinkedGong ? "Gong" : "Granola"}
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            {/* Meeting URL */}
            {event.meetingUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                asChild
              >
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1"
                >
                  <Video className="h-3 w-3" />
                  Join Meeting
                </a>
              </Button>
            )}

            {/* Source badge */}
            <Badge variant="outline" className="text-xs capitalize">
              {event.source === "google" ? "Google Calendar" : "Manual"}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
