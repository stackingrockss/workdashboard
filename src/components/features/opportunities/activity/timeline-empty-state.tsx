"use client";

// Empty state component for when there are no meetings in the timeline

import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimelineEmptyStateProps {
  hasFilters: boolean;
  onAddMeeting?: () => void;
}

export function TimelineEmptyState({
  hasFilters,
  onAddMeeting,
}: TimelineEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Calendar className="h-8 w-8 text-muted-foreground" />
      </div>

      {hasFilters ? (
        <>
          <h3 className="text-lg font-semibold mb-2">No meetings match filters</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-4">
            Try adjusting your filters or search query to see more meetings.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-semibold mb-2">No meetings yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-4">
            Add meetings to track customer interactions and link call recordings
            for AI-powered insights.
          </p>
          {onAddMeeting && (
            <Button onClick={onAddMeeting} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Meeting
            </Button>
          )}
        </>
      )}
    </div>
  );
}
