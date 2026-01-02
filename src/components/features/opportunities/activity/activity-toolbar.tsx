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
import { Label } from "@/components/ui/label";
import { AddManualMeetingDialog } from "@/components/calendar/AddManualMeetingDialog";
import { RefreshCw, Search, Lightbulb, Link2, X, UserPlus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ActivityFilters } from "@/types/activity";
import type { TimelineDateRange } from "@/types/timeline";

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
  const [enrichOnImport, setEnrichOnImport] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.searchQuery) {
        onFiltersChange({ ...filters, searchQuery: searchInput });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters, onFiltersChange]);

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

  const handleOpenImportDialog = useCallback(() => {
    setIsImportDialogOpen(true);
    setEnrichOnImport(false);
    setImportPreview(null);
    loadImportPreview();
  }, [loadImportPreview]);

  const handleImport = useCallback(async () => {
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
  }, [opportunityId, enrichOnImport, onContactsImported]);

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

        {/* Import Attendees button - only show when there are events */}
        {totalCount > 0 && (
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
    </div>
  );
}
