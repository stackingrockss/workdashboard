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
import { AddManualMeetingDialog } from "@/components/calendar/AddManualMeetingDialog";
import { RefreshCw, Search, Lightbulb, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityFilters } from "@/types/activity";
import type { TimelineDateRange } from "@/types/timeline";

interface ActivityToolbarProps {
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onRefresh: () => void;
  opportunityId: string;
  isLoading: boolean;
  totalCount: number;
  filteredCount: number;
}

export function ActivityToolbar({
  filters,
  onFiltersChange,
  onRefresh,
  opportunityId,
  isLoading,
  totalCount,
  filteredCount,
}: ActivityToolbarProps) {
  const [searchInput, setSearchInput] = useState(filters.searchQuery);

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
    </div>
  );
}
