"use client";

// Toolbar for the Activity tab with filters, search, and actions

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AddManualMeetingDialog } from "@/components/calendar/AddManualMeetingDialog";
import { ContactForm } from "@/components/forms/ContactForm";
import { RefreshCw, Search, Lightbulb, Link2, X, UserPlus, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ActivityFilters } from "@/types/activity";
import type { TimelineDateRange } from "@/types/timeline";
import type { ContactCreateInput, ContactUpdateInput } from "@/lib/validations/contact";

interface ImportableAttendee {
  email: string;
  alreadyExists: boolean;
  sourceEventIds: string[];
}

interface ImportPreview {
  attendees: ImportableAttendee[];
  newCount: number;
  existingCount: number;
  dismissedCount: number;
  canEnrich: boolean;
}

interface ActivityToolbarProps {
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onRefresh: () => void;
  opportunityId: string;
  isLoading: boolean;
  totalCount: number;
  filteredCount: number;
  onContactsImported?: () => void;
}

export function ActivityToolbar({
  filters,
  onFiltersChange,
  onRefresh,
  opportunityId,
  isLoading,
  totalCount,
  filteredCount,
  onContactsImported,
}: ActivityToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.searchQuery);

  // Import dialog state
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [dismissingEmail, setDismissingEmail] = useState<string | null>(null);

  // Manual contact form dialog state
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualFormEmail, setManualFormEmail] = useState<string>("");
  const [savingManualContact, setSavingManualContact] = useState(false);

  // Check for importable attendees on mount
  const [hasImportableAttendees, setHasImportableAttendees] = useState(false);
  const [checkingImportable, setCheckingImportable] = useState(true);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.searchQuery) {
        onFiltersChange({ ...filters, searchQuery: searchInput });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters, onFiltersChange]);

  // Check for importable attendees on mount and when contacts are imported
  const checkImportableAttendees = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/contacts/import-from-calendar`
      );
      if (response.ok) {
        const data = await response.json();
        setHasImportableAttendees(data.newCount > 0);
      }
    } catch {
      // Ignore errors, just don't show the button
    } finally {
      setCheckingImportable(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    checkImportableAttendees();
  }, [checkImportableAttendees]);

  const handleDateRangeChange = useCallback(
    (value: string) => {
      onFiltersChange({
        ...filters,
        dateRange: value as TimelineDateRange,
      });
    },
    [filters, onFiltersChange]
  );

  const toggleHasInsights = useCallback(() => {
    onFiltersChange({
      ...filters,
      hasInsights: filters.hasInsights === true ? null : true,
    });
  }, [filters, onFiltersChange]);

  const toggleHasRecording = useCallback(() => {
    onFiltersChange({
      ...filters,
      hasRecording: filters.hasRecording === true ? null : true,
    });
  }, [filters, onFiltersChange]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    onFiltersChange({ ...filters, searchQuery: "" });
  }, [filters, onFiltersChange]);

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
      const data: ImportPreview = await response.json();
      setImportPreview(data);
      // Pre-select all new (non-existing) attendees
      const newEmails = new Set(
        data.attendees
          .filter((a) => !a.alreadyExists)
          .map((a) => a.email)
      );
      setSelectedEmails(newEmails);
    } catch (err) {
      console.error("Failed to load import preview:", err);
      toast.error("Failed to load attendee preview");
      setIsImportDialogOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  }, [opportunityId]);

  const handleOpenImportDialog = useCallback(() => {
    setIsImportDialogOpen(true);
    setImportPreview(null);
    setSelectedEmails(new Set());
    loadImportPreview();
  }, [loadImportPreview]);

  // Toggle email selection
  const toggleEmailSelection = useCallback((email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  }, []);

  // Dismiss an attendee
  const handleDismissAttendee = useCallback(
    async (email: string, sourceEventId?: string) => {
      setDismissingEmail(email);
      try {
        const response = await fetch(
          `/api/v1/opportunities/${opportunityId}/contacts/dismiss-attendee`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, sourceCalendarEventId: sourceEventId }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to dismiss attendee");
        }

        // Remove from selection
        setSelectedEmails((prev) => {
          const next = new Set(prev);
          next.delete(email);
          return next;
        });

        // Reload preview
        await loadImportPreview();
        toast.success("Attendee dismissed");
      } catch (err) {
        console.error("Failed to dismiss attendee:", err);
        toast.error("Failed to dismiss attendee");
      } finally {
        setDismissingEmail(null);
      }
    },
    [opportunityId, loadImportPreview]
  );

  // Open manual contact form for a single email
  const handleAddManually = useCallback((email: string) => {
    setManualFormEmail(email);
    setIsManualFormOpen(true);
  }, []);

  // Handle manual contact form submission
  const handleManualContactSubmit = useCallback(
    async (data: ContactCreateInput | ContactUpdateInput) => {
      setSavingManualContact(true);
      try {
        const response = await fetch(
          `/api/v1/opportunities/${opportunityId}/contacts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create contact");
        }

        toast.success("Contact created successfully");
        setIsManualFormOpen(false);
        setManualFormEmail("");

        // Remove from selection and reload preview
        setSelectedEmails((prev) => {
          const next = new Set(prev);
          next.delete(manualFormEmail);
          return next;
        });

        // Reload preview and update button visibility
        await loadImportPreview();
        await checkImportableAttendees();
        onContactsImported?.();
      } catch (err) {
        console.error("Failed to create contact:", err);
        toast.error(err instanceof Error ? err.message : "Failed to create contact");
      } finally {
        setSavingManualContact(false);
      }
    },
    [opportunityId, manualFormEmail, loadImportPreview, checkImportableAttendees, onContactsImported]
  );

  // Import selected contacts with enrichment
  const handleImportWithEnrich = useCallback(async () => {
    if (selectedEmails.size === 0) {
      toast.error("Please select at least one contact to import");
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/contacts/import-from-calendar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enrich: true,
            selectedEmails: Array.from(selectedEmails),
          }),
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
        await checkImportableAttendees();
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
  }, [opportunityId, selectedEmails, onContactsImported, checkImportableAttendees]);

  const hasActiveFilters =
    filters.hasInsights !== null ||
    filters.hasRecording !== null ||
    filters.searchQuery.trim() !== "";

  const showingFiltered = filteredCount !== totalCount;

  return (
    <div className="space-y-3">
      {/* Main toolbar row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range filter */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="date-range-select"
            className="text-sm font-medium text-muted-foreground whitespace-nowrap"
          >
            Show:
          </label>
          <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
            <SelectTrigger id="date-range-select" className="w-[140px]">
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

        {/* Filter chips */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleHasInsights}
            className={cn(
              "h-8",
              filters.hasInsights === true &&
                "bg-primary/10 border-primary text-primary"
            )}
          >
            <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
            Has Insights
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleHasRecording}
            className={cn(
              "h-8",
              filters.hasRecording === true &&
                "bg-primary/10 border-primary text-primary"
            )}
          >
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Has Recording
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Refresh button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8"
        >
          <RefreshCw
            className={cn("h-4 w-4", isLoading && "animate-spin")}
          />
          <span className="sr-only">Refresh</span>
        </Button>

        {/* Import Attendees button - only show when there are new attendees to import */}
        {!checkingImportable && hasImportableAttendees && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenImportDialog}
            className="h-8"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Import Attendees
          </Button>
        )}

        {/* Add Meeting */}
        <AddManualMeetingDialog
          opportunityId={opportunityId}
          onMeetingAdded={onRefresh}
        />
      </div>

      {/* Search row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search meetings or attendees..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-8 h-9"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={clearSearch}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>

        {/* Results count */}
        {totalCount > 0 && (
          <p
            className="text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {showingFiltered ? (
              <>
                Showing {filteredCount} of {totalCount} meeting
                {totalCount !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                {totalCount} meeting{totalCount !== 1 ? "s" : ""}
              </>
            )}
          </p>
        )}
      </div>

      {/* Import Attendees Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Meeting Attendees</DialogTitle>
            <DialogDescription>
              Select attendees to import as contacts. You can add them manually or import with enrichment.
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : importPreview ? (
            <div className="space-y-4">
              {importPreview.attendees.filter((a) => !a.alreadyExists).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {importPreview.dismissedCount > 0
                    ? `No new attendees to import. ${importPreview.dismissedCount} attendee${importPreview.dismissedCount !== 1 ? "s" : ""} dismissed.`
                    : "All attendees already exist as contacts."}
                </p>
              ) : (
                <>
                  <div className="max-h-72 overflow-y-auto space-y-1 border rounded-md p-2">
                    {importPreview.attendees
                      .filter((a) => !a.alreadyExists)
                      .map((attendee) => (
                        <div
                          key={attendee.email}
                          className="flex items-center gap-2 text-sm py-1.5 px-1 rounded hover:bg-muted/50 group"
                        >
                          <Checkbox
                            id={`attendee-${attendee.email}`}
                            checked={selectedEmails.has(attendee.email)}
                            onCheckedChange={() => toggleEmailSelection(attendee.email)}
                            disabled={importing || dismissingEmail === attendee.email}
                          />
                          <label
                            htmlFor={`attendee-${attendee.email}`}
                            className="flex-1 truncate cursor-pointer"
                          >
                            {attendee.email}
                          </label>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleAddManually(attendee.email)}
                              disabled={importing || dismissingEmail === attendee.email}
                            >
                              Add
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                handleDismissAttendee(
                                  attendee.email,
                                  attendee.sourceEventIds[0]
                                )
                              }
                              disabled={importing || dismissingEmail === attendee.email}
                            >
                              {dismissingEmail === attendee.email ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                              <span className="sr-only">Dismiss</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {selectedEmails.size} of{" "}
                      {importPreview.attendees.filter((a) => !a.alreadyExists).length} selected
                    </span>
                    {importPreview.dismissedCount > 0 && (
                      <span className="text-xs">
                        {importPreview.dismissedCount} dismissed
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            {importPreview && selectedEmails.size === 1 && (
              <Button
                variant="outline"
                onClick={() => handleAddManually(Array.from(selectedEmails)[0])}
                disabled={importing || loadingPreview}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Add Manually
              </Button>
            )}
            {importPreview && importPreview.canEnrich && (
              <Button
                onClick={handleImportWithEnrich}
                disabled={
                  importing ||
                  loadingPreview ||
                  selectedEmails.size === 0
                }
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Import & Enrich ({selectedEmails.size})
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Contact Form Dialog */}
      <Dialog open={isManualFormOpen} onOpenChange={setIsManualFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Create a new contact for {manualFormEmail}
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            onSubmit={handleManualContactSubmit}
            onCancel={() => {
              setIsManualFormOpen(false);
              setManualFormEmail("");
            }}
            initialData={{ email: manualFormEmail }}
            submitLabel={savingManualContact ? "Creating..." : "Create Contact"}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
