"use client";

// Main activity section container - redesigned with split view layout
// Features: Aggregated insights summary, enhanced toolbar, vertical timeline, persistent detail panel

import { useState, useEffect, useCallback, useMemo } from "react";
import { ActivityInsightsSummaryCard } from "./activity-insights-summary-card";
import { ActivityToolbar } from "./activity-toolbar";
import { ActivitySplitView } from "./activity-split-view";
import { AddGongFromCalendarDialog } from "./add-gong-from-calendar-dialog";
import { AddGranolaFromCalendarDialog } from "./add-granola-from-calendar-dialog";
import { toast } from "sonner";
import { aggregateInsights, filterEvents } from "@/lib/utils/aggregate-insights";
import {
  defaultActivityFilters,
  type ActivityFilters,
} from "@/types/activity";
import type {
  TimelineEvent,
  PreselectedCalendarEvent,
} from "@/types/timeline";

interface ActivitySectionProps {
  opportunityId: string;
  onViewInsights?: (callId: string) => void;
}

interface TimelineResponse {
  events: TimelineEvent[];
  mostRecentCall: {
    id: string;
    title: string;
    meetingDate: string;
    painPoints: string[] | null;
    goals: string[] | null;
    nextSteps: string[] | null;
    type: "gong" | "granola";
  } | null;
  meta: {
    totalCount: number;
    gongCallCount: number;
    granolaNotesCount: number;
  };
}

export function ActivitySection({
  opportunityId,
}: ActivitySectionProps) {
  // Data state
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [filters, setFilters] = useState<ActivityFilters>(defaultActivityFilters);

  // Selection state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Dialog state for adding Gong/Granola from calendar events
  const [addGongCalendarEvent, setAddGongCalendarEvent] =
    useState<PreselectedCalendarEvent | null>(null);
  const [addGranolaCalendarEvent, setAddGranolaCalendarEvent] =
    useState<PreselectedCalendarEvent | null>(null);

  // Derived state: filtered events
  const filteredEvents = useMemo(() => {
    return filterEvents(events, filters);
  }, [events, filters]);

  // Derived state: aggregated insights (from all events, not just filtered)
  const aggregatedInsights = useMemo(() => {
    return aggregateInsights(events);
  }, [events]);

  // Check if filters are active (excluding dateRange which is handled by API)
  const hasActiveFilters = useMemo(() => {
    return (
      filters.hasInsights !== null ||
      filters.hasRecording !== null ||
      filters.searchQuery.trim() !== ""
    );
  }, [filters]);

  // Fetch timeline data
  const fetchTimeline = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateRange !== "all") {
        params.set("dateRange", filters.dateRange);
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
  }, [opportunityId, filters.dateRange]);

  // Fetch on mount and when dateRange changes
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Handle filters change
  const handleFiltersChange = useCallback((newFilters: ActivityFilters) => {
    setFilters(newFilters);
  }, []);

  // Handle Gong added from calendar event - refresh and close dialog
  const handleGongAdded = useCallback(() => {
    setAddGongCalendarEvent(null);
    setSelectedEventId(null);
    fetchTimeline();
  }, [fetchTimeline]);

  // Handle Granola added from calendar event - refresh and close dialog
  const handleGranolaAdded = useCallback(() => {
    setAddGranolaCalendarEvent(null);
    setSelectedEventId(null);
    fetchTimeline();
  }, [fetchTimeline]);

  return (
    <div className="space-y-6">
      {/* Aggregated Insights Summary */}
      <ActivityInsightsSummaryCard
        insights={aggregatedInsights}
        isLoading={isLoading}
      />

      {/* Toolbar with filters, search, and actions */}
      <ActivityToolbar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onRefresh={fetchTimeline}
        opportunityId={opportunityId}
        isLoading={isLoading}
        totalCount={events.length}
        filteredCount={filteredEvents.length}
      />

      {/* Split View: Timeline + Detail Panel */}
      <ActivitySplitView
        events={filteredEvents}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
        opportunityId={opportunityId}
        onAddGong={setAddGongCalendarEvent}
        onAddGranola={setAddGranolaCalendarEvent}
        onRefresh={fetchTimeline}
        isLoading={isLoading}
        hasFilters={hasActiveFilters}
      />

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
