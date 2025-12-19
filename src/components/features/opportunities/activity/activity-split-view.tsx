"use client";

// Split view layout for the Activity tab
// Left: Vertical meeting timeline | Right: Persistent detail panel

import { VerticalMeetingTimeline } from "./vertical-meeting-timeline";
import { MeetingDetailPanel } from "./meeting-detail-panel";
import type { TimelineEvent, PreselectedCalendarEvent } from "@/types/timeline";

interface ActivitySplitViewProps {
  events: TimelineEvent[];
  selectedEventId: string | null;
  onSelectEvent: (eventId: string | null) => void;
  opportunityId: string;
  onAddGong: (calendarEvent: PreselectedCalendarEvent) => void;
  onAddGranola: (calendarEvent: PreselectedCalendarEvent) => void;
  onRefresh: () => void;
  isLoading: boolean;
  hasFilters: boolean;
  onAddMeeting?: () => void;
}

export function ActivitySplitView({
  events,
  selectedEventId,
  onSelectEvent,
  opportunityId,
  onAddGong,
  onAddGranola,
  onRefresh,
  isLoading,
  hasFilters,
  onAddMeeting,
}: ActivitySplitViewProps) {
  // Find selected event
  const selectedEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId) || null
    : null;

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[500px]">
      {/* Left Panel - Timeline */}
      <div className="lg:w-[360px] lg:flex-none h-[400px] lg:h-auto">
        <VerticalMeetingTimeline
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={(eventId) => onSelectEvent(eventId)}
          isLoading={isLoading}
          hasFilters={hasFilters}
          onAddMeeting={onAddMeeting}
        />
      </div>

      {/* Right Panel - Details */}
      <div className="flex-1 min-w-0 h-[500px] lg:h-auto">
        <MeetingDetailPanel
          event={selectedEvent}
          opportunityId={opportunityId}
          allEvents={events}
          onClose={() => onSelectEvent(null)}
          onAddGong={onAddGong}
          onAddGranola={onAddGranola}
          onRefresh={onRefresh}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
