"use client";

// Inline expandable detail panel for timeline events
// Shows full meeting details with pain points, goals, next steps

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  StickyNote,
  Calendar,
  ExternalLink,
  Eye,
  ChevronUp,
  AlertTriangle,
  Target,
  ListChecks,
  Users,
  Video,
  Lightbulb,
  BarChart3,
  Loader2,
  Plus,
  Link2,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";
import type { TimelineEvent, PreselectedCalendarEvent, CalendarEventTimelineEvent } from "@/types/timeline";

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
  event: CalendarEventTimelineEvent;
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
  const isGongCall = event.type === "gong_call";
  const isCalendarEvent = event.type === "calendar_event";

  // Safely extract parsed data for Gong calls
  const painPoints =
    isGongCall && Array.isArray(event.painPoints)
      ? (event.painPoints as string[]).filter((p) => typeof p === "string")
      : [];

  const goals =
    isGongCall && Array.isArray(event.goals)
      ? (event.goals as string[]).filter((g) => typeof g === "string")
      : [];

  const nextSteps =
    isGongCall && Array.isArray(event.nextSteps)
      ? (event.nextSteps as string[]).filter((s) => typeof s === "string")
      : [];

  const whyAndWhyNow =
    isGongCall && Array.isArray(event.whyAndWhyNow)
      ? (event.whyAndWhyNow as string[]).filter((w) => typeof w === "string")
      : [];

  const quantifiableMetrics =
    isGongCall && Array.isArray(event.quantifiableMetrics)
      ? (event.quantifiableMetrics as string[]).filter((m) => typeof m === "string")
      : [];

  const hasParsedContent =
    isGongCall &&
    event.parsingStatus === "completed" &&
    (painPoints.length > 0 ||
      goals.length > 0 ||
      nextSteps.length > 0 ||
      whyAndWhyNow.length > 0 ||
      quantifiableMetrics.length > 0);

  return (
    <Card className="p-4 mt-4 animate-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isGongCall
                ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
                : isCalendarEvent
                ? "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400"
                : "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400"
            }`}
          >
            {isGongCall ? (
              <Phone className="h-5 w-5" />
            ) : isCalendarEvent ? (
              <Calendar className="h-5 w-5" />
            ) : (
              <StickyNote className="h-5 w-5" />
            )}
          </div>

          {/* Title and meta */}
          <div>
            <h3 className="font-semibold text-base">{event.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">
                {formatDateShort(event.date.toString())}
              </span>
              {!isCalendarEvent && event.noteType && (
                <Badge variant="outline" className="text-xs">
                  {event.noteType}
                </Badge>
              )}
              {isGongCall && event.parsingStatus && (
                <Badge
                  variant={
                    event.parsingStatus === "completed"
                      ? "default"
                      : event.parsingStatus === "failed"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-xs"
                >
                  {event.parsingStatus}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Collapse button */}
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Parsed content for Gong calls */}
      {hasParsedContent && (
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          {/* Pain Points */}
          {painPoints.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Pain Points
              </div>
              <ul className="text-sm space-y-1 list-disc list-inside">
                {painPoints.map((point, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Goals */}
          {goals.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Target className="h-4 w-4 text-blue-500" />
                Goals
              </div>
              <ul className="text-sm space-y-1 list-disc list-inside">
                {goals.map((goal, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {nextSteps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ListChecks className="h-4 w-4 text-green-500" />
                Next Steps
              </div>
              <ul className="text-sm space-y-1 list-disc list-inside">
                {nextSteps.map((step, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Why and Why Now? */}
          {whyAndWhyNow.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Why and Why Now?
              </div>
              <ul className="text-sm space-y-1 list-disc list-inside">
                {whyAndWhyNow.map((reason, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quantifiable Metrics */}
          {quantifiableMetrics.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                Quantifiable Metrics
              </div>
              <ul className="text-sm space-y-1 list-disc list-inside">
                {quantifiableMetrics.map((metric, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {metric}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Calendar event details */}
      {isCalendarEvent && (
        <div className="space-y-3 mb-4">
          {/* Description */}
          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}

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
            event={event as CalendarEventTimelineEvent}
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
      )}

      {/* No parsed content message for Granola or unparsed Gong */}
      {!hasParsedContent && !isCalendarEvent && (
        <p className="text-sm text-muted-foreground mb-4">
          {isGongCall && event.parsingStatus !== "completed"
            ? "This call has not been parsed yet. Parse the transcript to extract insights."
            : "View the full note in the external app for more details."}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t">
        {/* External link for Gong/Granola */}
        {!isCalendarEvent && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open in {isGongCall ? "Gong" : "Granola"}
            </a>
          </Button>
        )}

        {/* Meeting URL for calendar events */}
        {isCalendarEvent && event.meetingUrl && (
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

        {isGongCall && event.parsingStatus === "completed" && onViewInsights && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onViewInsights(event.id)}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Full Insights
          </Button>
        )}
      </div>
    </Card>
  );
}
