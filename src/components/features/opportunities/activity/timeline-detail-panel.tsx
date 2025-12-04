"use client";

// Inline expandable detail panel for calendar events
// Shows meeting details with linked Gong/Granola content

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  StickyNote,
  Calendar,
  Eye,
  ChevronUp,
  Users,
  Video,
  Loader2,
  Plus,
  Link2,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";
import type { TimelineEvent, PreselectedCalendarEvent } from "@/types/timeline";

interface TimelineDetailPanelProps {
  event: TimelineEvent;
  onClose: () => void;
  onViewInsights?: (eventId: string) => void;
  onAddGong?: (calendarEvent: PreselectedCalendarEvent) => void;
  onAddGranola?: (calendarEvent: PreselectedCalendarEvent) => void;
}

/**
 * Sub-component to show linked transcript info or add buttons for calendar events
 */
function LinkedTranscriptInfo({
  event,
  onAddGong,
  onAddGranola,
  onViewInsights,
}: {
  event: TimelineEvent;
  onAddGong?: (calendarEvent: PreselectedCalendarEvent) => void;
  onAddGranola?: (calendarEvent: PreselectedCalendarEvent) => void;
  onViewInsights?: (eventId: string) => void;
}) {
  const linkedGong = event.linkedGongCall;
  const linkedGranola = event.linkedGranolaNote;

  // Create preselected calendar event for dialog
  const preselectedEvent: PreselectedCalendarEvent = {
    id: event.id,
    title: event.title,
    startTime: event.date,
  };

  // Helper to render parsing status badge
  const renderParsingBadge = (status: string | null) => {
    if (!status) return null;
    return (
      <Badge
        variant={
          status === "completed"
            ? "default"
            : status === "failed"
            ? "destructive"
            : "secondary"
        }
        className="text-xs"
      >
        {status === "parsing" && (
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        )}
        {status}
      </Badge>
    );
  };

  // Linked Gong call
  if (linkedGong) {
    return (
      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium">Linked Gong Recording</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm">{linkedGong.title}</span>
            {renderParsingBadge(linkedGong.parsingStatus)}
          </div>
          {linkedGong.hasInsights && onViewInsights && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewInsights(linkedGong.id)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Insights
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Linked Granola note
  if (linkedGranola) {
    return (
      <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium">Linked Granola Note</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm">{linkedGranola.title}</span>
            {renderParsingBadge(linkedGranola.parsingStatus)}
          </div>
          {linkedGranola.hasInsights && onViewInsights && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewInsights(linkedGranola.id)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Insights
            </Button>
          )}
        </div>
      </div>
    );
  }

  // No linked transcript - show add buttons
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Plus className="h-4 w-4" />
        <span>Add meeting notes or recording</span>
      </div>
      <div className="flex gap-2">
        {onAddGong && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddGong(preselectedEvent)}
          >
            <Phone className="h-4 w-4 mr-2" />
            Add Gong Recording
          </Button>
        )}
        {onAddGranola && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddGranola(preselectedEvent)}
          >
            <StickyNote className="h-4 w-4 mr-2" />
            Add Granola Note
          </Button>
        )}
      </div>
    </div>
  );
}

export function TimelineDetailPanel({
  event,
  onClose,
  onViewInsights,
  onAddGong,
  onAddGranola,
}: TimelineDetailPanelProps) {
  return (
    <Card className="p-4 mt-4 animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400">
            <Calendar className="h-5 w-5" />
          </div>

          {/* Title and meta */}
          <div>
            <h3 className="font-semibold text-base">{event.title}</h3>
            <span className="text-sm text-muted-foreground">
              {formatDateShort(event.date.toString())}
            </span>
          </div>
        </div>

        {/* Collapse button */}
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar event details */}
      <div className="space-y-3 mb-4">
        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4 text-purple-500" />
              Attendees
            </div>
            <div className="flex flex-wrap gap-1">
              {event.attendees.map((attendee, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {attendee}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Linked transcript section */}
        <LinkedTranscriptInfo
          event={event}
          onAddGong={onAddGong}
          onAddGranola={onAddGranola}
          onViewInsights={onViewInsights}
        />

        {/* Source badge */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {event.source === "google" ? "Google Calendar" : "Manual"}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t">
        {/* Meeting URL for calendar events */}
        {event.meetingUrl && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={event.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <Video className="h-4 w-4" />
              Join Meeting
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}
