"use client";

// Main timeline section component with filtering controls
// Fetches calendar events timeline (with linked Gong/Granola content)

import { useState, useEffect, useCallback } from "react";
import { TimelineView } from "./timeline-view";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type {
  TimelineEvent,
  TimelineDateRange,
} from "@/types/timeline";

interface TimelineSectionProps {
  opportunityId: string;
  onViewInsights?: (callId: string) => void;
}

interface TimelineResponse {
  events: TimelineEvent[];
  meta: {
    totalCount: number;
    meetingCount: number;
  };
}

export function TimelineSection({
  opportunityId,
  onViewInsights,
}: TimelineSectionProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<TimelineDateRange>("all");

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
        throw new Error("Failed to fetch timeline");
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
      console.error("Error fetching timeline:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load timeline events. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [opportunityId, dateRange]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return (
    <div className="space-y-6">
      {/* Filter controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label
            htmlFor="date-range-select"
            className="text-sm font-medium text-muted-foreground"
          >
            Date Range:
          </label>
          <Select
            value={dateRange}
            onValueChange={(value) => setDateRange(value as TimelineDateRange)}
          >
            <SelectTrigger id="date-range-select" className="w-[180px]">
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
          variant="outline"
          size="sm"
          onClick={fetchTimeline}
          disabled={isLoading}
          className="ml-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Results summary with ARIA live region for accessibility */}
      {!isLoading && events.length > 0 && (
        <div
          className="text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Showing {events.length} meeting{events.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Timeline view */}
      <TimelineView
        events={events}
        isLoading={isLoading}
        onViewInsights={onViewInsights}
      />
    </div>
  );
}
