"use client";

// Inline detail panel for calendar events
// Shows meeting details with linked Gong/Granola content
// Gong insights auto-display with priority; Granola insights only shown when no Gong exists

import { useState } from "react";
import { Card } from "@/components/ui/card";
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
  Calendar,
  ChevronUp,
  Users,
  Video,
  Loader2,
  Link2,
  AlertTriangle,
  Target,
  ListChecks,
  MoreHorizontal,
  Unlink,
  ArrowRightLeft,
  ExternalLink,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { toast } from "sonner";
import type { TimelineEvent, PreselectedCalendarEvent, LinkedTranscriptSummary } from "@/types/timeline";

interface TimelineDetailPanelProps {
  event: TimelineEvent;
  onClose: () => void;
  onAddGong?: (calendarEvent: PreselectedCalendarEvent) => void;
  onAddGranola?: (calendarEvent: PreselectedCalendarEvent) => void;
  opportunityId?: string;
  allEvents?: TimelineEvent[];
  onRefresh?: () => void;
}

/**
 * Sub-component to render insights (pain points, goals, next steps)
 */
function InsightsDisplay({ transcript }: { transcript: LinkedTranscriptSummary }) {
  const { painPoints, goals, nextSteps } = transcript;
  const hasAnyInsights = painPoints.length > 0 || goals.length > 0 || nextSteps.length > 0;

  if (!hasAnyInsights) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No insights extracted yet.
      </p>
    );
  }

  return (
    <div className="space-y-3 pt-2 border-t border-dashed">
      {painPoints.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Pain Points
          </div>
          <ul className="text-sm space-y-0.5 list-disc list-inside text-muted-foreground ml-1">
            {painPoints.map((point, idx) => (
              <li key={idx}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {goals.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
            <Target className="h-3.5 w-3.5" />
            Goals
          </div>
          <ul className="text-sm space-y-0.5 list-disc list-inside text-muted-foreground ml-1">
            {goals.map((goal, idx) => (
              <li key={idx}>{goal}</li>
            ))}
          </ul>
        </div>
      )}

      {nextSteps.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
            <ListChecks className="h-3.5 w-3.5" />
            Next Steps
          </div>
          <ul className="text-sm space-y-0.5 list-disc list-inside text-muted-foreground ml-1">
            {nextSteps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Sub-component to show linked transcript info or add buttons for calendar events
 */
function LinkedTranscriptInfo({
  event,
  onAddGong,
  onAddGranola,
  opportunityId,
  allEvents,
  onRefresh,
}: {
  event: TimelineEvent;
  onAddGong?: (calendarEvent: PreselectedCalendarEvent) => void;
  onAddGranola?: (calendarEvent: PreselectedCalendarEvent) => void;
  opportunityId?: string;
  allEvents?: TimelineEvent[];
  onRefresh?: () => void;
}) {
  const [isUnlinkingGong, setIsUnlinkingGong] = useState(false);
  const [isUnlinkingGranola, setIsUnlinkingGranola] = useState(false);
  const [movingGongToEventId, setMovingGongToEventId] = useState<string | null>(null);
  const [movingGranolaToEventId, setMovingGranolaToEventId] = useState<string | null>(null);

  const linkedGong = event.linkedGongCall;
  const linkedGranola = event.linkedGranolaNote;

  // Create preselected calendar event for dialog
  const preselectedEvent: PreselectedCalendarEvent = {
    id: event.id,
    title: event.title,
    startTime: event.date,
  };

  // Filter out current event from move options
  const otherEvents = allEvents?.filter((e) => e.id !== event.id) || [];

  // Handle unlink Gong call
  const handleUnlinkGong = async () => {
    if (!opportunityId || !linkedGong) return;
    setIsUnlinkingGong(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/gong-calls/${linkedGong.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: null }),
        }
      );
      if (!response.ok) throw new Error("Failed to unlink");
      toast.success("Gong call unlinked from meeting");
      onRefresh?.();
    } catch (error) {
      console.error("Failed to unlink Gong call:", error);
      toast.error("Failed to unlink Gong call");
    } finally {
      setIsUnlinkingGong(false);
    }
  };

  // Handle move Gong call to another meeting
  const handleMoveGong = async (targetEventId: string) => {
    if (!opportunityId || !linkedGong) return;
    setMovingGongToEventId(targetEventId);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/gong-calls/${linkedGong.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: targetEventId }),
        }
      );
      if (!response.ok) throw new Error("Failed to move");
      toast.success("Gong call moved to another meeting");
      onRefresh?.();
    } catch (error) {
      console.error("Failed to move Gong call:", error);
      toast.error("Failed to move Gong call");
    } finally {
      setMovingGongToEventId(null);
    }
  };

  // Handle unlink Granola note
  const handleUnlinkGranola = async () => {
    if (!opportunityId || !linkedGranola) return;
    setIsUnlinkingGranola(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/granola-notes/${linkedGranola.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: null }),
        }
      );
      if (!response.ok) throw new Error("Failed to unlink");
      toast.success("Granola note unlinked from meeting");
      onRefresh?.();
    } catch (error) {
      console.error("Failed to unlink Granola note:", error);
      toast.error("Failed to unlink Granola note");
    } finally {
      setIsUnlinkingGranola(false);
    }
  };

  // Handle move Granola note to another meeting
  const handleMoveGranola = async (targetEventId: string) => {
    if (!opportunityId || !linkedGranola) return;
    setMovingGranolaToEventId(targetEventId);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/granola-notes/${linkedGranola.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: targetEventId }),
        }
      );
      if (!response.ok) throw new Error("Failed to move");
      toast.success("Granola note moved to another meeting");
      onRefresh?.();
    } catch (error) {
      console.error("Failed to move Granola note:", error);
      toast.error("Failed to move Granola note");
    } finally {
      setMovingGranolaToEventId(null);
    }
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

  // Check if we can show management actions
  const canManage = opportunityId && onRefresh;

  // Show Gong insights with priority, Granola as fallback
  return (
    <div className="space-y-3">
      {/* Gong section - show linked or add button */}
      {linkedGong ? (
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">Linked Gong Recording</span>
            </div>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={isUnlinkingGong || !!movingGongToEventId}
                  >
                    {isUnlinkingGong || movingGongToEventId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleUnlinkGong}>
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
                              onClick={() => handleMoveGong(targetEvent.id)}
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
            )}
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <a
              href={linkedGong.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline inline-flex items-center gap-1"
            >
              {linkedGong.title}
              <ExternalLink className="h-3 w-3" />
            </a>
            {renderParsingBadge(linkedGong.parsingStatus)}
          </div>
          {/* Auto-display Gong insights */}
          <InsightsDisplay transcript={linkedGong} />
        </div>
      ) : onAddGong && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddGong(preselectedEvent)}
          >
            <Phone className="h-4 w-4 mr-2" />
            Add Gong Recording
          </Button>
        </div>
      )}

      {/* Granola section - show linked or add button */}
      {/* Only auto-display Granola insights when there's no Gong (Gong takes priority) */}
      {linkedGranola ? (
        <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium">Linked Granola Note</span>
            </div>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={isUnlinkingGranola || !!movingGranolaToEventId}
                  >
                    {isUnlinkingGranola || movingGranolaToEventId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleUnlinkGranola}>
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
                              onClick={() => handleMoveGranola(targetEvent.id)}
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
            )}
          </div>
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-green-600 dark:text-green-400" />
            <a
              href={linkedGranola.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline inline-flex items-center gap-1"
            >
              {linkedGranola.title}
              <ExternalLink className="h-3 w-3" />
            </a>
            {renderParsingBadge(linkedGranola.parsingStatus)}
          </div>
          {/* Only show Granola insights if no Gong call exists */}
          {!linkedGong && <InsightsDisplay transcript={linkedGranola} />}
        </div>
      ) : onAddGranola && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddGranola(preselectedEvent)}
          >
            <StickyNote className="h-4 w-4 mr-2" />
            Add Granola Note
          </Button>
        </div>
      )}
    </div>
  );
}

export function TimelineDetailPanel({
  event,
  onClose,
  onAddGong,
  onAddGranola,
  opportunityId,
  allEvents,
  onRefresh,
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
          opportunityId={opportunityId}
          allEvents={allEvents}
          onRefresh={onRefresh}
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
