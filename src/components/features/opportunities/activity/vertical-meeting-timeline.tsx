"use client";

// Vertical timeline component for the left panel of the Activity tab
// Displays meetings grouped by month with visual timeline

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { MeetingTimelineItem } from "./meeting-timeline-item";
import { TimelineEmptyState } from "./timeline-empty-state";
import { groupEventsByMonth } from "@/types/timeline";
import type { TimelineEvent } from "@/types/timeline";

interface VerticalMeetingTimelineProps {
  events: TimelineEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
  isLoading: boolean;
  hasFilters: boolean;
  onAddMeeting?: () => void;
}

export function VerticalMeetingTimeline({
  events,
  selectedEventId,
  onSelectEvent,
  isLoading,
  hasFilters,
  onAddMeeting,
}: VerticalMeetingTimelineProps) {
  // Sort events newest first and group by month
  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [events]);

  const groupedByMonth = useMemo(() => {
    return groupEventsByMonth(sortedEvents);
  }, [sortedEvents]);

  // Convert to array sorted by month (newest first)
  const monthEntries = useMemo(() => {
    return Array.from(groupedByMonth.entries()).sort((a, b) => {
      const dateA = new Date(a[1][0]?.date || 0);
      const dateB = new Date(b[1][0]?.date || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [groupedByMonth]);

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (events.length === 0) {
    return (
      <Card className="h-full">
        <TimelineEmptyState hasFilters={hasFilters} onAddMeeting={onAddMeeting} />
      </Card>
    );
  }

  // Calculate total event count for isLast calculation
  let eventIndex = 0;
  const totalEvents = events.length;

  return (
    <Card className="h-full flex flex-col">
      <div className="px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Meeting Timeline</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {events.length} meeting{events.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {monthEntries.map(([monthKey, monthEvents]) => (
            <div key={monthKey} className="mb-4 last:mb-0">
              {/* Month header */}
              <div className="sticky top-0 z-10 bg-card px-2 py-1.5 mb-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {monthKey}
                </h4>
              </div>

              {/* Events in this month */}
              <div className="space-y-0">
                {monthEvents
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                  )
                  .map((event) => {
                    eventIndex++;
                    const isLast = eventIndex === totalEvents;
                    return (
                      <MeetingTimelineItem
                        key={event.id}
                        event={event}
                        isSelected={event.id === selectedEventId}
                        isLast={isLast}
                        onClick={() => onSelectEvent(event.id)}
                      />
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

function TimelineSkeleton() {
  return (
    <Card className="h-full flex flex-col">
      <div className="px-4 py-3 border-b">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20 mt-1.5" />
      </div>

      <div className="p-2 space-y-4">
        {[1, 2].map((month) => (
          <div key={month}>
            <Skeleton className="h-3 w-24 mb-2 mx-2" />
            <div className="space-y-1">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-start gap-3 p-3">
                  <Skeleton className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                    <div className="flex gap-1.5">
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
