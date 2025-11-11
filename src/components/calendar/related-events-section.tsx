"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Plus, AlertCircle } from "lucide-react";
import { CalendarEvent } from "@/types/calendar";
import { CalendarEventCard } from "./calendar-event-card";
import { ScheduleFollowupDialog } from "./schedule-followup-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RelatedEventsSectionProps {
  opportunityId: string;
  opportunityName: string;
  accountId?: string;
  contactEmails?: string[];
}

/**
 * RelatedEventsSection - Shows calendar events related to an opportunity
 *
 * Features:
 * - Displays past and upcoming meetings
 * - Groups by past/upcoming
 * - "Schedule Follow-up" button
 * - Auto-filters by account email domain or contact emails
 */
export function RelatedEventsSection({
  opportunityId,
  opportunityName,
  accountId,
  contactEmails = [],
}: RelatedEventsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    loadRelatedEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId, accountId]);

  const loadRelatedEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch events from 90 days ago to 90 days in the future
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        opportunityId,
      });

      if (accountId) {
        params.append("accountId", accountId);
      }

      const response = await fetch(
        `/api/v1/integrations/google/calendar/events?${params}`
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
      setEvents(data.events);
    } catch (err) {
      console.error("Failed to load related events:", err);
      setError("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleSuccess = () => {
    // Reload events after scheduling
    loadRelatedEvents();
  };

  const now = new Date();
  const pastEvents = events.filter(
    (event) => new Date(event.endTime) < now
  );
  const upcomingEvents = events.filter(
    (event) => new Date(event.startTime) >= now
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Related Calendar Events
            </CardTitle>
            <Skeleton className="h-9 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
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
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Related Calendar Events
          </CardTitle>
          <CardDescription>
            View and schedule meetings for this opportunity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              Connect Google Calendar to view and schedule meetings for this opportunity.
            </AlertDescription>
          </Alert>
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
              Related Calendar Events
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScheduleDialog(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Schedule Follow-up
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={loadRelatedEvents} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Related Calendar Events
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScheduleDialog(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Schedule Follow-up
            </Button>
          </div>
          <CardDescription>
            {events.length > 0
              ? `${pastEvents.length} past, ${upcomingEvents.length} upcoming meeting${upcomingEvents.length !== 1 ? "s" : ""}`
              : "No meetings found for this opportunity"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {events.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No calendar events found for this opportunity</p>
              <p className="text-sm mt-1">
                Schedule a follow-up meeting to get started
              </p>
            </div>
          ) : (
            <>
              {/* Upcoming Meetings */}
              {upcomingEvents.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Upcoming Meetings ({upcomingEvents.length})
                  </h3>
                  <div className="space-y-2">
                    {upcomingEvents.map((event) => (
                      <CalendarEventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}

              {/* Past Meetings */}
              {pastEvents.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Past Meetings ({pastEvents.length})
                  </h3>
                  <div className="space-y-2">
                    {pastEvents
                      .sort(
                        (a, b) =>
                          new Date(b.startTime).getTime() -
                          new Date(a.startTime).getTime()
                      )
                      .slice(0, 5) // Show only last 5
                      .map((event) => (
                        <CalendarEventCard key={event.id} event={event} />
                      ))}
                  </div>
                  {pastEvents.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      + {pastEvents.length - 5} more past meeting
                      {pastEvents.length - 5 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Schedule Follow-up Dialog */}
      <ScheduleFollowupDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        opportunityId={opportunityId}
        opportunityName={opportunityName}
        contactEmails={contactEmails}
        onSuccess={handleScheduleSuccess}
      />
    </>
  );
}
