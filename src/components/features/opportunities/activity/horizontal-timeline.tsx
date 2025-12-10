"use client";

// Horizontal timeline component displaying meetings grouped by month
// Scrolls left to right (oldest to newest)

import { useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TimelineNode } from "./timeline-node";
import { TimelineDetailPanel } from "./timeline-detail-panel";
import { groupEventsByMonth } from "@/types/timeline";
import type { TimelineEvent, PreselectedCalendarEvent } from "@/types/timeline";

interface HorizontalTimelineProps {
  events: TimelineEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string | null) => void;
  onViewInsights?: (eventId: string) => void;
  onAddGong?: (calendarEvent: PreselectedCalendarEvent) => void;
  onAddGranola?: (calendarEvent: PreselectedCalendarEvent) => void;
  isLoading: boolean;
}

export function HorizontalTimeline({
  events,
  selectedEventId,
  onSelectEvent,
  onViewInsights,
  onAddGong,
  onAddGranola,
  isLoading,
}: HorizontalTimelineProps) {
  // Sort events oldest to newest (left to right)
  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [events]);

  // Group events by month
  const groupedByMonth = useMemo(() => {
    return groupEventsByMonth(sortedEvents);
  }, [sortedEvents]);

  // Convert to array and sort chronologically (oldest month first)
  const monthEntries = useMemo(() => {
    return Array.from(groupedByMonth.entries()).sort((a, b) => {
      // Parse month keys like "November 2024" to dates for sorting
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateA.getTime() - dateB.getTime();
    });
  }, [groupedByMonth]);

  // Find selected event
  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No activity yet for this opportunity.</p>
        <p className="text-sm mt-1">
          Add meetings or calls to see them on the timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Horizontal scrolling timeline */}
      <ScrollArea className="w-full">
        <div className="relative min-h-[220px]">
          {/* Timeline line - centered vertically */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-border" />

          {/* Month groups */}
          <div className="flex gap-8 px-4 h-full items-center pt-6">
            {monthEntries.map(([monthKey, monthEvents]) => (
              <div key={monthKey} className="flex-shrink-0 relative">
                {/* Month header - positioned at top */}
                <div className="absolute -top-6 left-0">
                  <h3 className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
                    {monthKey}
                  </h3>
                </div>

                {/* Events in this month - staggered top/bottom */}
                <div className="flex gap-3 items-center">
                  {monthEvents
                    .sort(
                      (a, b) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    )
                    .map((event, index) => (
                      <TimelineNode
                        key={event.id}
                        event={event}
                        position={index % 2 === 0 ? 'bottom' : 'top'}
                        isSelected={event.id === selectedEventId}
                        onClick={() =>
                          onSelectEvent(
                            event.id === selectedEventId ? null : event.id
                          )
                        }
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Detail panel (expands inline when event selected) */}
      {selectedEvent && (
        <TimelineDetailPanel
          event={selectedEvent}
          onClose={() => onSelectEvent(null)}
          onAddGong={onAddGong}
          onAddGranola={onAddGranola}
        />
      )}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <div className="relative min-h-[220px]">
        {/* Timeline line skeleton */}
        <Skeleton className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5" />

        <div className="flex gap-8 px-4 h-full items-center pt-6">
          {[1, 2, 3].map((month) => (
            <div key={month} className="flex-shrink-0 relative">
              <Skeleton className="absolute -top-6 left-0 h-4 w-24" />
              <div className="flex gap-3 items-center">
                {[1, 2].map((event, index) => (
                  <div
                    key={event}
                    className={`flex items-center gap-2 ${index % 2 === 0 ? 'flex-col' : 'flex-col-reverse'}`}
                  >
                    <Skeleton className="w-[160px] h-[100px] rounded-lg" />
                    <Skeleton className="w-3 h-3 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
