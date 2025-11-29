"use client";

import { useState } from "react";
import { CalendarEvent } from "@/types/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, ChevronRight, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateShort } from "@/lib/format";

interface CalendarEventCardProps {
  event: CalendarEvent;
}

/**
 * CalendarEventCard - Displays a collapsible calendar event card
 *
 * Collapsed state shows:
 * - Meeting title
 * - Start time
 * - External badge (if applicable)
 * - Attendee count badge
 *
 * Expanded state shows:
 * - Full date and time range with duration
 * - All attendees
 *
 * Used in:
 * - Dashboard "Upcoming Meetings" widget
 * - Opportunity detail "Related Calendar Events" section
 */
export function CalendarEventCard({ event }: CalendarEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDuration = () => {
    const durationMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ""}`;
    }
    return `${minutes}m`;
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* Collapsed state - always visible */}
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              {/* Left: Title + time */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{event.summary}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(startTime)}</span>
                </div>
              </div>

              {/* Right: Badges + chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {event.isExternal && (
                  <Badge variant="secondary" className="text-xs">
                    External
                  </Badge>
                )}
                {event.attendees.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {event.attendees.length}
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded state - shows full details */}
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 px-3 space-y-2 border-t">
            {/* Full date and time range */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formatDateShort(startTime.toISOString())}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>
                  {formatTime(startTime)} - {formatTime(endTime)} ({getDuration()})
                </span>
              </div>
            </div>

            {/* Full attendee list */}
            {event.attendees.length > 0 && (
              <div className="flex items-start gap-1.5 text-sm">
                <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <span className="text-muted-foreground">
                    {event.attendees.slice(0, 3).join(", ")}
                    {event.attendees.length > 3 &&
                      ` +${event.attendees.length - 3} more`}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
