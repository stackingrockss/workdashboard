"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Settings, AlertCircle } from "lucide-react";
import { CalendarEvent } from "@/types/calendar";
import { CalendarEventCard } from "./calendar-event-card";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * UpcomingMeetingsWidget - Shows next 5 external meetings on the dashboard
 *
 * Features:
 * - Displays external meetings only
 * - Groups by date (Today, Tomorrow, [Date])
 * - Links to opportunity detail if matched
 * - "Connect Calendar" CTA if not connected
 * - Settings gear icon redirects to integrations settings
 */
export function UpcomingMeetingsWidget() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    loadUpcomingMeetings();
  }, []);

  const loadUpcomingMeetings = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch next 7 days of external meetings
      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await fetch(
        `/api/v1/integrations/google/calendar/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&externalOnly=true`
      );

      if (response.status === 400) {
        const data = await response.json();
        if (data.error?.includes("not connected")) {
          setNotConnected(true);
          return;
        }
      }

      if (!response.ok) {
        throw new Error("Failed to fetch calendar events");
      }

      const data = await response.json();
      // Take only the first 5 upcoming meetings
      setEvents(data.events.slice(0, 5));
    } catch (err) {
      console.error("Failed to load upcoming meetings:", err);
      setError("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  const groupEventsByDate = (events: CalendarEvent[]) => {
    const groups: Record<string, CalendarEvent[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    events.forEach((event) => {
      const eventDate = new Date(event.startTime);
      eventDate.setHours(0, 0, 0, 0);

      let label: string;
      if (eventDate.getTime() === today.getTime()) {
        label = "Today";
      } else if (eventDate.getTime() === tomorrow.getTime()) {
        label = "Tomorrow";
      } else {
        label = eventDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(event);
    });

    return groups;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming External Meetings
            </CardTitle>
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (notConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming External Meetings
            </CardTitle>
            <Link href="/settings/integrations">
              <Settings className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
            </Link>
          </div>
          <CardDescription>
            View and manage your external meetings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              Connect your Google Calendar to view upcoming external meetings alongside your opportunities.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Link href="/settings/integrations">
              <Button className="w-full">Connect Google Calendar</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming External Meetings
            </CardTitle>
            <Link href="/settings/integrations">
              <Settings className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={loadUpcomingMeetings} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming External Meetings
            </CardTitle>
            <Link href="/settings/integrations">
              <Settings className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
            </Link>
          </div>
          <CardDescription>
            You have no external meetings in the next 7 days
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const groupedEvents = groupEventsByDate(events);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming External Meetings
          </CardTitle>
          <Link href="/settings/integrations">
            <Settings className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
          </Link>
        </div>
        <CardDescription>
          Next 5 external meetings in the next 7 days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedEvents).map(([dateLabel, dateEvents]) => (
          <div key={dateLabel} className="space-y-2">
            <h4 className="font-semibold text-sm text-muted-foreground">
              {dateLabel}
            </h4>
            <div className="space-y-2">
              {dateEvents.map((event) => (
                <CalendarEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
