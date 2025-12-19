"use client";

// Right panel component showing details for a selected meeting
// Shows meeting info, linked transcripts, and extracted insights

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MousePointerClick,
  Users,
  Video,
  X,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";
import {
  LinkedTranscriptCard,
  AddTranscriptButton,
} from "./linked-transcript-card";
import { InsightsDisplay } from "./insights-display";
import type { TimelineEvent, PreselectedCalendarEvent } from "@/types/timeline";

interface MeetingDetailPanelProps {
  event: TimelineEvent | null;
  opportunityId: string;
  allEvents: TimelineEvent[];
  onClose: () => void;
  onAddGong: (calendarEvent: PreselectedCalendarEvent) => void;
  onAddGranola: (calendarEvent: PreselectedCalendarEvent) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function MeetingDetailPanel({
  event,
  opportunityId,
  allEvents,
  onClose,
  onAddGong,
  onAddGranola,
  onRefresh,
  isLoading,
}: MeetingDetailPanelProps) {
  if (isLoading) {
    return <DetailPanelSkeleton />;
  }

  if (!event) {
    return <EmptySelectionState />;
  }

  const preselectedEvent: PreselectedCalendarEvent = {
    id: event.id,
    title: event.title,
    startTime: event.date,
  };

  // Determine which insights to show (Gong takes priority)
  const gongInsights = event.linkedGongCall;
  const granolaInsights = event.linkedGranolaNote;
  const primaryInsights = gongInsights || granolaInsights;

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{event.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">
                  {formatDateShort(event.date.toString())}
                </span>
                <Badge variant="outline" className="text-xs capitalize">
                  {event.source === "google" ? "Google Calendar" : "Manual"}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0 h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </CardHeader>

      <Separator />

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <CardContent className="pt-4 space-y-4">
          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4 text-purple-500" />
                Attendees ({event.attendees.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {event.attendees.map((attendee, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {attendee}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Linked Transcripts */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Linked Recordings
            </h4>

            {/* Gong */}
            {event.linkedGongCall ? (
              <LinkedTranscriptCard
                transcript={event.linkedGongCall}
                type="gong"
                opportunityId={opportunityId}
                calendarEventId={event.id}
                allEvents={allEvents}
                onRefresh={onRefresh}
                showInsights={true}
              />
            ) : (
              <AddTranscriptButton
                type="gong"
                onAdd={() => onAddGong(preselectedEvent)}
              />
            )}

            {/* Granola */}
            {event.linkedGranolaNote ? (
              <LinkedTranscriptCard
                transcript={event.linkedGranolaNote}
                type="granola"
                opportunityId={opportunityId}
                calendarEventId={event.id}
                allEvents={allEvents}
                onRefresh={onRefresh}
                // Only show Granola insights if no Gong (Gong takes priority)
                showInsights={!event.linkedGongCall}
              />
            ) : (
              <AddTranscriptButton
                type="granola"
                onAdd={() => onAddGranola(preselectedEvent)}
              />
            )}
          </div>

          {/* Consolidated Insights (if no linked transcript shows them) */}
          {primaryInsights && !event.linkedGongCall && !event.linkedGranolaNote && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Extracted Insights
                </h4>
                <InsightsDisplay
                  painPoints={primaryInsights.painPoints}
                  goals={primaryInsights.goals}
                  nextSteps={primaryInsights.nextSteps}
                  showEmpty
                  showCopyButtons
                />
              </div>
            </>
          )}

          {/* Meeting URL action */}
          {event.meetingUrl && (
            <>
              <Separator />
              <div>
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
              </div>
            </>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}

function EmptySelectionState() {
  return (
    <Card className="h-full flex items-center justify-center text-center p-8">
      <div className="space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <MousePointerClick className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Select a Meeting</h3>
          <p className="text-sm text-muted-foreground max-w-xs mt-1">
            Click on a meeting in the timeline to view its details, linked
            recordings, and extracted insights.
          </p>
        </div>
      </div>
    </Card>
  );
}

function DetailPanelSkeleton() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}
