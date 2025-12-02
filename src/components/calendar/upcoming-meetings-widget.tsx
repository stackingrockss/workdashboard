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
  const [domainNotSet, setDomainNotSet] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    orgDomain: string | null;
    totalEvents: number;
    externalCount: number;
    internalCount: number;
  } | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    loadUpcomingMeetings();
  }, []);

  const loadUpcomingMeetings = async () => {
    setLoading(true);
    setError(null);
    setNotConnected(false);
    setDomainNotSet(false);

    try {
      // First, check if organization domain is set
      const orgResponse = await fetch('/api/v1/organization');
      let orgDomain: string | null = null;

      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        orgDomain = orgData.organization?.domain || null;

        if (!orgDomain) {
          setDomainNotSet(true);
          return;
        }
      }

      // Fetch next 7 days of external meetings
      const startDate = new Date();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Fetch external meetings
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

      // For debug mode: also fetch ALL events to compare
      const allEventsResponse = await fetch(
        `/api/v1/integrations/google/calendar/events?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&externalOnly=false`
      );

      const safeDataEvents = Array.isArray(data.events) ? data.events : [];

      let internalCount = 0;
      if (allEventsResponse.ok) {
        const allData = await allEventsResponse.json();
        const safeAllDataEvents = Array.isArray(allData.events) ? allData.events : [];
        const totalEvents = safeAllDataEvents.length;
        const externalCount = safeDataEvents.length;
        internalCount = totalEvents - externalCount;

        setDebugInfo({
          orgDomain,
          totalEvents,
          externalCount,
          internalCount,
        });

        // Log detailed info for debugging
        console.log('[Calendar Widget] Debug Info:', {
          orgDomain,
          totalEvents,
          externalCount,
          internalCount,
          externalEvents: safeDataEvents.map((e: CalendarEvent) => ({
            summary: e.summary,
            attendees: e.attendees,
            isExternal: e.isExternal,
          })),
        });
      }

      // Take only the first 5 upcoming meetings
      setEvents(safeDataEvents.slice(0, 5));
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
      <Card className="h-fit">
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

  if (domainNotSet) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming External Meetings
            </CardTitle>
            <Link href="/settings/organization">
              <Settings className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
            </Link>
          </div>
          <CardDescription>
            View and manage your external meetings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Organization domain not configured.</strong> External meetings are detected by comparing attendee email domains with your organization domain.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Link href="/settings/organization">
              <Button className="w-full">Configure Organization Domain</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (notConnected) {
    return (
      <Card className="h-fit">
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
      <Card className="h-fit">
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
      <Card className="h-fit">
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
            You have no external meetings in the next 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            External meetings are detected by comparing attendee email domains with your organization domain.
            Make sure your organization domain is configured in{' '}
            <Link href="/settings/organization" className="text-primary hover:underline">
              Organization Settings
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  const groupedEvents = groupEventsByDate(events);

  return (
    <Card className="h-fit">
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
          Click to expand • Next 5 external meetings in 7 days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Debug info toggle */}
        {debugInfo && (
          <div className="border-b pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showDebug ? "Hide" : "Show"} Debug Info
            </Button>

            {showDebug && (
              <div className="mt-2 p-3 bg-muted/50 rounded-md text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-semibold">Organization Domain:</span>
                    <br />
                    <code className="text-primary">{debugInfo.orgDomain || "Not set"}</code>
                  </div>
                  <div>
                    <span className="font-semibold">Total Events (7 days):</span>
                    <br />
                    <code>{debugInfo.totalEvents}</code>
                  </div>
                  <div>
                    <span className="font-semibold">External Meetings:</span>
                    <br />
                    <code className="text-green-600">{debugInfo.externalCount}</code>
                  </div>
                  <div>
                    <span className="font-semibold">Internal Meetings:</span>
                    <br />
                    <code className="text-orange-600">{debugInfo.internalCount}</code>
                  </div>
                </div>
                <p className="text-muted-foreground pt-2 border-t">
                  External meetings have at least one attendee with a different email domain than <code>{debugInfo.orgDomain}</code>.
                  Check browser console for detailed attendee information.
                </p>
              </div>
            )}
          </div>
        )}

        {Object.entries(groupedEvents).map(([dateLabel, dateEvents]) => (
          <div key={dateLabel} className="space-y-1.5">
            <h4 className="font-semibold text-sm text-muted-foreground">
              {dateLabel}
            </h4>
            <div className="space-y-1.5">
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
