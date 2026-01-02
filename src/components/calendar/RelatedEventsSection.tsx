"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, AlertCircle, UserPlus, Check, Loader2 } from "lucide-react";
import { CalendarEvent } from "@/types/calendar";
import { CalendarEventCard } from "./CalendarEventCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ImportableAttendee {
  email: string;
  alreadyExists: boolean;
}

interface ImportPreview {
  attendees: ImportableAttendee[];
  newCount: number;
  existingCount: number;
  canEnrich: boolean;
}

interface RelatedEventsSectionProps {
  opportunityId: string;
  accountId?: string;
  onContactsImported?: () => void;
}

/**
 * RelatedEventsSection - Shows calendar events related to an opportunity
 *
 * Features:
 * - Displays past and upcoming meetings
 * - Groups by past/upcoming
 * - Auto-filters by account email domain or contact emails
 */
export function RelatedEventsSection({
  opportunityId,
  accountId,
  onContactsImported,
}: RelatedEventsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notConnected, setNotConnected] = useState(false);

  // Import dialog state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [enrichOnImport, setEnrichOnImport] = useState(false);

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
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      console.error("Failed to load related events:", err);
      setError("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  };

  // Load import preview when dialog opens
  const loadImportPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/contacts/import-from-calendar`
      );
      if (!response.ok) {
        throw new Error("Failed to load preview");
      }
      const data = await response.json();
      setImportPreview(data);
    } catch (err) {
      console.error("Failed to load import preview:", err);
      toast.error("Failed to load attendee preview");
      setIsImportDialogOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  }, [opportunityId]);

  const handleOpenImportDialog = () => {
    setIsImportDialogOpen(true);
    setEnrichOnImport(false);
    loadImportPreview();
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/contacts/import-from-calendar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrich: enrichOnImport }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to import contacts");
      }

      const result = await response.json();

      if (result.imported > 0) {
        if (result.enriched > 0) {
          toast.success(
            `Imported ${result.imported} contact${result.imported !== 1 ? "s" : ""} (${result.enriched} enriched)`
          );
        } else {
          toast.success(
            `Imported ${result.imported} contact${result.imported !== 1 ? "s" : ""}`
          );
        }
        onContactsImported?.();
      } else {
        toast.info("No new contacts to import");
      }

      setIsImportDialogOpen(false);
    } catch (err) {
      console.error("Failed to import contacts:", err);
      toast.error(err instanceof Error ? err.message : "Failed to import contacts");
    } finally {
      setImporting(false);
    }
  };

  const now = new Date();
  const safeEvents = Array.isArray(events) ? events : [];
  const pastEvents = safeEvents.filter(
    (event) => new Date(event.endTime) < now
  );
  const upcomingEvents = safeEvents.filter(
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
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Related Calendar Events
          </CardTitle>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Related Calendar Events
            </CardTitle>
            <CardDescription>
              {events.length > 0
                ? `${pastEvents.length} past, ${upcomingEvents.length} upcoming meeting${upcomingEvents.length !== 1 ? "s" : ""}`
                : "No meetings found for this opportunity"}
            </CardDescription>
          </div>
          {events.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenImportDialog}
              className="flex-shrink-0"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Import Attendees
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {events.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No calendar events found for this opportunity</p>
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

      {/* Import Attendees Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Meeting Attendees</DialogTitle>
            <DialogDescription>
              Import external attendees from calendar events as contacts.
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : importPreview ? (
            <div className="space-y-4">
              {importPreview.attendees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No external attendees found in calendar events.
                </p>
              ) : (
                <>
                  <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-3">
                    {importPreview.attendees.map((attendee) => (
                      <div
                        key={attendee.email}
                        className={`flex items-center gap-2 text-sm ${
                          attendee.alreadyExists ? "text-muted-foreground" : ""
                        }`}
                      >
                        {attendee.alreadyExists ? (
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" />
                        )}
                        <span className="truncate">{attendee.email}</span>
                        {attendee.alreadyExists && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            (exists)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {importPreview.newCount > 0 ? (
                      <>
                        <strong>{importPreview.newCount}</strong> new contact
                        {importPreview.newCount !== 1 ? "s" : ""} will be imported
                        {importPreview.existingCount > 0 && (
                          <> ({importPreview.existingCount} already exist)</>
                        )}
                      </>
                    ) : (
                      "All attendees already exist as contacts."
                    )}
                  </p>

                  {importPreview.newCount > 0 && importPreview.canEnrich && (
                    <div className="flex items-center space-x-2 pt-2 border-t">
                      <Checkbox
                        id="enrichOnImport"
                        checked={enrichOnImport}
                        onCheckedChange={(checked) =>
                          setEnrichOnImport(checked === true)
                        }
                        disabled={importing}
                      />
                      <Label
                        htmlFor="enrichOnImport"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Also enrich contacts (LinkedIn, title, bio)
                      </Label>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={
                importing ||
                loadingPreview ||
                !importPreview ||
                importPreview.newCount === 0
              }
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  Import {importPreview?.newCount || 0} Contact
                  {importPreview?.newCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
