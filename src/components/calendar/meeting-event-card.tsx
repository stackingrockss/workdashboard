"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ChevronRight, MapPin, Users, Video, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarEvent } from "@/types/calendar";
import { GongCall } from "@/types/gong-call";
import { GranolaNote } from "@/types/granola-note";
import { GongCallItem } from "./gong-call-item";
import { GranolaNoteItem } from "./granola-note-item";
import { formatDateShort } from "@/lib/format";

interface MeetingEventCardProps {
  event: CalendarEvent;
  gongCalls?: GongCall[];
  granolaNotes?: GranolaNote[];
  opportunityId: string;
  onRefresh?: () => void;
  onAddGongCall?: (event: CalendarEvent) => void;
  onAddGranolaNote?: (event: CalendarEvent) => void;
  onViewInsights?: (call: GongCall) => void;
  onParse?: (call: GongCall) => void;
  defaultExpanded?: boolean;
}

/**
 * MeetingEventCard - Display a single calendar event with expandable Gong/Granola sections
 *
 * Card Header (Always Visible):
 * - Calendar event title (summary)
 * - Date and time
 * - Attendee count
 * - Badge showing count: [2 Gong | 1 Granola]
 *
 * Expandable Content (Click to expand):
 * - Gong Calls section with list of calls
 * - Granola Notes section with list of notes
 * - "Add Gong Call" and "Add Granola Note" buttons
 */
export function MeetingEventCard({
  event,
  gongCalls = [],
  granolaNotes = [],
  opportunityId,
  onRefresh,
  onAddGongCall,
  onAddGranolaNote,
  onViewInsights,
  onParse,
  defaultExpanded = false,
}: MeetingEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const gongCount = gongCalls.length;
  const granolaCount = granolaNotes.length;
  const totalNotes = gongCount + granolaCount;

  const formatEventTime = (startTime: Date | string, endTime: Date | string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);

    const timeFormat: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };

    return `${start.toLocaleTimeString("en-US", timeFormat)} - ${end.toLocaleTimeString("en-US", timeFormat)}`;
  };

  return (
    <Card className="overflow-hidden">
      {/* Card Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Event Title */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h3 className="font-semibold text-sm truncate">{event.summary}</h3>
              {event.source === 'manual' && (
                <Badge variant="outline" className="text-xs flex-shrink-0">Manual</Badge>
              )}
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span>
                {formatDateShort(typeof event.startTime === 'string' ? event.startTime : event.startTime.toISOString())} at{" "}
                {formatEventTime(event.startTime, event.endTime)}
              </span>
            </div>

            {/* Attendees */}
            {event.attendees.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  {event.attendees.slice(0, 3).join(", ")}
                  {event.attendees.length > 3 && ` +${event.attendees.length - 3} more`}
                </span>
              </div>
            )}

            {/* Meeting URL */}
            {event.meetingUrl && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Video className="h-3 w-3 flex-shrink-0" />
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate"
                  onClick={(e) => e.stopPropagation()}
                >
                  Join Meeting
                </a>
              </div>
            )}
          </div>

          {/* Notes Count Badge & Expand Icon */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {totalNotes > 0 && (
              <Badge variant="secondary" className="text-xs">
                {gongCount} Gong | {granolaCount} Granola
              </Badge>
            )}
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4 space-y-4 border-t">
          {/* Gong Calls Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                🎥 Gong Calls ({gongCount})
              </h4>
              {onAddGongCall && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddGongCall(event)}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Gong
                </Button>
              )}
            </div>

            {gongCalls.length > 0 ? (
              <div className="space-y-1">
                {gongCalls.map((call) => (
                  <GongCallItem
                    key={call.id}
                    call={call}
                    opportunityId={opportunityId}
                    onDelete={onRefresh}
                    onUnlink={onRefresh}
                    onViewInsights={onViewInsights}
                    onParse={onParse}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No Gong calls linked yet</p>
            )}
          </div>

          {/* Granola Notes Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                📝 Granola Notes ({granolaCount})
              </h4>
              {onAddGranolaNote && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddGranolaNote(event)}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Granola
                </Button>
              )}
            </div>

            {granolaNotes.length > 0 ? (
              <div className="space-y-1">
                {granolaNotes.map((note) => (
                  <GranolaNoteItem
                    key={note.id}
                    note={note}
                    opportunityId={opportunityId}
                    onDelete={onRefresh}
                    onUnlink={onRefresh}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No Granola notes linked yet</p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
