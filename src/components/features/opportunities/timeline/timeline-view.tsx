"use client";

// Timeline view component with vertical layout and alternating cards
// Groups events by month and displays with central line

import { useMemo } from "react";
import { TimelineEventCard } from "./timeline-event-card";
import { groupEventsByMonth, type TimelineEvent } from "@/types/timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface TimelineViewProps {
  events: TimelineEvent[];
  isLoading?: boolean;
  onViewInsights?: (callId: string) => void;
  onAddEvent?: () => void;
}

export function TimelineView({
  events,
  isLoading,
  onViewInsights,
  onAddEvent,
}: TimelineViewProps) {
  // Group events by month (memoized for performance)
  // Must be called before any conditional returns
  const groupedEvents = useMemo(
    () => groupEventsByMonth(events),
    [events]
  );

  if (isLoading) {
    return <TimelineLoadingSkeleton />;
  }

  if (events.length === 0) {
    return <TimelineEmptyState onAddEvent={onAddEvent} />;
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2" />

      {/* Timeline events */}
      <div className="space-y-8">
        {Array.from(groupedEvents.entries()).map(([monthKey, monthEvents]) => (
          <div key={monthKey} className="space-y-6">
            {/* Month header */}
            <div className="relative flex justify-center">
              <div className="bg-background px-4 py-2 rounded-full border shadow-sm z-10">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  {monthKey}
                </h3>
              </div>
            </div>

            {/* Events for this month */}
            <div className="space-y-6">
              {monthEvents.map((event, index) => {
                // Alternate left and right positioning
                const position = index % 2 === 0 ? "left" : "right";

                return (
                  <div key={event.id} className="relative">
                    <TimelineEventCard
                      event={event}
                      position={position}
                      onViewInsights={onViewInsights}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineEmptyState({ onAddEvent }: { onAddEvent?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2">No Timeline Events</h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        Gong calls and Granola notes will appear here once they&apos;re added to this
        opportunity.
      </p>
      {onAddEvent && (
        <Button onClick={onAddEvent} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Your First Call
        </Button>
      )}
    </div>
  );
}

function TimelineLoadingSkeleton() {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border -translate-x-1/2" />

      {/* Skeleton events */}
      <div className="space-y-8">
        {[1, 2, 3].map((group) => (
          <div key={group} className="space-y-6">
            {/* Month header skeleton */}
            <div className="relative flex justify-center">
              <Skeleton className="h-9 w-40 rounded-full" />
            </div>

            {/* Event skeletons */}
            <div className="space-y-6">
              {[1, 2].map((item) => {
                const position = item % 2 === 0 ? "left" : "right";
                return (
                  <div
                    key={item}
                    className={`flex items-center gap-4 ${
                      position === "left" ? "flex-row" : "flex-row-reverse"
                    }`}
                  >
                    <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                    <Skeleton
                      className={`flex-1 h-32 ${
                        position === "left" ? "mr-8" : "ml-8"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
