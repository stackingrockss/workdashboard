"use client";

// Main activity section container with filters and timeline
// Combines Timeline + Meetings & Calls into a unified horizontal view

import { useState, useEffect, useCallback } from "react";
import { HorizontalTimeline } from "./horizontal-timeline";
import { AddManualMeetingDialog } from "@/components/calendar/add-manual-meeting-dialog";
import { AddGongFromCalendarDialog } from "./add-gong-from-calendar-dialog";
import { AddGranolaFromCalendarDialog } from "./add-granola-from-calendar-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  RefreshCw,
  Phone,
  StickyNote,
  AlertTriangle,
  Target,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/format";
import type {
  TimelineEvent,
  TimelineDateRange,
  PreselectedCalendarEvent,
} from "@/types/timeline";

interface ActivitySectionProps {
  opportunityId: string;
  onViewInsights?: (callId: string) => void;
}

interface MostRecentCall {
  id: string;
  title: string;
  meetingDate: string;
  painPoints: string[] | null;
  goals: string[] | null;
  nextSteps: string[] | null;
  type: "gong" | "granola";
}

interface TimelineResponse {
  events: TimelineEvent[];
  mostRecentCall: MostRecentCall | null;
  meta: {
    totalCount: number;
    gongCallCount: number;
    granolaNotesCount: number;
  };
}

/**
 * Component to display the most recent call insights
 */
function LatestCallInsights({ call }: { call: MostRecentCall }) {
  const painPoints = Array.isArray(call.painPoints) ? call.painPoints : [];
  const goals = Array.isArray(call.goals) ? call.goals : [];
  const nextSteps = Array.isArray(call.nextSteps) ? call.nextSteps : [];
  const hasAnyInsights = painPoints.length > 0 || goals.length > 0 || nextSteps.length > 0;

  const isGong = call.type === "gong";
  const bgColor = isGong
    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
    : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
  const iconColor = isGong
    ? "text-blue-600 dark:text-blue-400"
    : "text-green-600 dark:text-green-400";
  const Icon = isGong ? Phone : StickyNote;

  return (
    <Card className={`p-4 ${bgColor}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <div>
          <h3 className="font-medium text-sm">Latest Call Insights</h3>
          <p className="text-sm text-muted-foreground">
            {call.title} &middot; {formatDateShort(call.meetingDate)}
          </p>
        </div>
      </div>

      {/* Insights */}
      {!hasAnyInsights ? (
        <p className="text-sm text-muted-foreground italic">
          No insights extracted yet.
        </p>
      ) : (
        <div className="space-y-3">
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
      )}
    </Card>
  );
}

export function ActivitySection({
  opportunityId,
  onViewInsights,
}: ActivitySectionProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [mostRecentCall, setMostRecentCall] = useState<MostRecentCall | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<TimelineDateRange>("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Dialog state for adding Gong/Granola from calendar events
  const [addGongCalendarEvent, setAddGongCalendarEvent] =
    useState<PreselectedCalendarEvent | null>(null);
  const [addGranolaCalendarEvent, setAddGranolaCalendarEvent] =
    useState<PreselectedCalendarEvent | null>(null);

  // Fetch timeline data
  const fetchTimeline = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange !== "all") {
        params.set("dateRange", dateRange);
      }

      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/timeline?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch activity");
      }

      const data: TimelineResponse = await response.json();

      // Convert date strings to Date objects
      const safeEvents = Array.isArray(data.events) ? data.events : [];
      const eventsWithDates = safeEvents.map((event) => ({
        ...event,
        date: new Date(event.date),
      }));

      setEvents(eventsWithDates);
      setMostRecentCall(data.mostRecentCall || null);
    } catch (error) {
      console.error("Error fetching activity:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load activity. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [opportunityId, dateRange]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Handle meeting added - refresh timeline
  const handleMeetingAdded = useCallback(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Handle Gong/Granola added from calendar event - refresh and close dialog
  const handleGongAdded = useCallback(() => {
    setAddGongCalendarEvent(null);
    setSelectedEventId(null); // Close the detail panel
    fetchTimeline();
  }, [fetchTimeline]);

  const handleGranolaAdded = useCallback(() => {
    setAddGranolaCalendarEvent(null);
    setSelectedEventId(null); // Close the detail panel
    fetchTimeline();
  }, [fetchTimeline]);

  return (
    <div className="space-y-6">
      {/* Filter controls and actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="date-range-select"
              className="text-sm font-medium text-muted-foreground"
            >
              Show:
            </label>
            <Select
              value={dateRange}
              onValueChange={(value) => setDateRange(value as TimelineDateRange)}
            >
              <SelectTrigger id="date-range-select" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="60">Last 60 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTimeline}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        <AddManualMeetingDialog
          opportunityId={opportunityId}
          onMeetingAdded={handleMeetingAdded}
        />
      </div>

      {/* Results summary */}
      {!isLoading && events.length > 0 && (
        <div
          className="text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {events.length} meeting{events.length !== 1 ? "s" : ""} &middot;{" "}
          Click to view details
        </div>
      )}

      {/* Horizontal timeline */}
      <HorizontalTimeline
        events={events}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
        onViewInsights={onViewInsights}
        onAddGong={setAddGongCalendarEvent}
        onAddGranola={setAddGranolaCalendarEvent}
        isLoading={isLoading}
      />

      {/* Latest call insights - shown below timeline */}
      {!isLoading && mostRecentCall && (
        <LatestCallInsights call={mostRecentCall} />
      )}

      {/* Add Gong from calendar event dialog */}
      {addGongCalendarEvent && (
        <AddGongFromCalendarDialog
          open={!!addGongCalendarEvent}
          onOpenChange={(open) => !open && setAddGongCalendarEvent(null)}
          opportunityId={opportunityId}
          calendarEvent={addGongCalendarEvent}
          onSuccess={handleGongAdded}
        />
      )}

      {/* Add Granola from calendar event dialog */}
      {addGranolaCalendarEvent && (
        <AddGranolaFromCalendarDialog
          open={!!addGranolaCalendarEvent}
          onOpenChange={(open) => !open && setAddGranolaCalendarEvent(null)}
          opportunityId={opportunityId}
          calendarEvent={addGranolaCalendarEvent}
          onSuccess={handleGranolaAdded}
        />
      )}
    </div>
  );
}
