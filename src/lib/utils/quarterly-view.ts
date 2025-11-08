/**
 * Utilities for generating "Quarterly View" - a virtual column mode that dynamically groups
 * opportunities by their calculated quarter instead of using database columns.
 */

import { Opportunity } from "@/types/opportunity";
import { SerializedKanbanColumn } from "@/types/view";
import {
  getQuarterFromDate,
  getQuarterDateRange,
  getCurrentQuarter,
  getPreviousQuarters,
  getNextQuarters,
  getQuarterStatus,
  getQuarterMonthRange,
} from "./quarter";

export const UNASSIGNED_QUARTER_ID = "unassigned";
export const UNASSIGNED_QUARTER_TITLE = "Unassigned";

// Default rolling window settings
export const DEFAULT_PAST_QUARTERS = 1; // Show last 1 quarter
export const DEFAULT_FUTURE_QUARTERS = 3; // Show next 3 quarters (+ current = 4 total)

/**
 * Generate virtual quarter-based columns from opportunities.
 * These columns are not stored in the database - they're dynamically generated.
 *
 * @param opportunities - All opportunities to analyze
 * @param fiscalYearStartMonth - Fiscal year start month (1=Jan, 2=Feb, etc.)
 * @param showAllQuarters - If true, shows all quarters with opportunities. If false, uses rolling window.
 * @returns Array of virtual column configs sorted chronologically
 */
export function generateQuarterlyColumns(
  opportunities: Opportunity[],
  fiscalYearStartMonth: number = 1,
  showAllQuarters: boolean = false
): SerializedKanbanColumn[] {
  let quarters: string[];

  if (showAllQuarters) {
    // Extract unique quarters from opportunities with close dates
    const quarterSet = new Set<string>();

    opportunities.forEach((opp) => {
      if (opp.closeDate) {
        try {
          const quarter = getQuarterFromDate(new Date(opp.closeDate), fiscalYearStartMonth);
          quarterSet.add(quarter);
        } catch (error) {
          console.error("Error calculating quarter for opportunity:", opp.id, error);
        }
      }
    });

    // Convert to sorted array and sort chronologically (not alphabetically)
    quarters = Array.from(quarterSet).sort((a, b) => {
      // Parse "Q1 2025" format
      const matchA = a.match(/Q(\d)\s+(\d{4})/);
      const matchB = b.match(/Q(\d)\s+(\d{4})/);

      if (!matchA || !matchB) return 0;

      const [, qA, yearA] = matchA;
      const [, qB, yearB] = matchB;

      // Sort by year first, then by quarter
      if (yearA !== yearB) {
        return parseInt(yearA) - parseInt(yearB);
      }
      return parseInt(qA) - parseInt(qB);
    });
  } else {
    // Use rolling window: last N quarters + current + next M quarters
    const pastQuarters = getPreviousQuarters(DEFAULT_PAST_QUARTERS, fiscalYearStartMonth);
    const currentAndFutureQuarters = getNextQuarters(DEFAULT_FUTURE_QUARTERS + 1, fiscalYearStartMonth); // +1 includes current

    quarters = [...pastQuarters, ...currentAndFutureQuarters];
  }

  // Create virtual column configs
  const now = new Date().toISOString();
  const columns: SerializedKanbanColumn[] = quarters.map((quarter, index) => {
    const status = getQuarterStatus(quarter, fiscalYearStartMonth);
    return {
      id: `virtual-${quarter.replace(/\s+/g, "-")}`, // e.g., "virtual-Q1-2025"
      title: quarter,
      subtitle: getQuarterMonthRange(quarter, fiscalYearStartMonth), // e.g., "Jan - Mar"
      order: index,
      color: getQuarterColor(status, index),
      viewId: "virtual-quarterly",
      createdAt: now,
      updatedAt: now,
      metadata: {
        quarterStatus: status, // "past" | "current" | "future"
      },
    };
  });

  // Add "Unassigned" column for opportunities without close dates
  const hasUnassigned = opportunities.some((opp) => !opp.closeDate);
  if (hasUnassigned) {
    columns.push({
      id: UNASSIGNED_QUARTER_ID,
      title: UNASSIGNED_QUARTER_TITLE,
      order: columns.length,
      color: "#6b7280", // gray-500
      viewId: "virtual-quarterly",
      createdAt: now,
      updatedAt: now,
    });
  }

  return columns;
}

/**
 * Group opportunities by their calculated quarter.
 *
 * @param opportunities - All opportunities to group
 * @param fiscalYearStartMonth - Fiscal year start month (1=Jan, 2=Feb, etc.)
 * @returns Record mapping column IDs to arrays of opportunities
 */
export function groupOpportunitiesByQuarter(
  opportunities: Opportunity[],
  fiscalYearStartMonth: number = 1
): Record<string, Opportunity[]> {
  const grouped: Record<string, Opportunity[]> = {};

  opportunities.forEach((opp) => {
    let columnId: string;

    if (opp.closeDate) {
      try {
        const quarter = getQuarterFromDate(new Date(opp.closeDate), fiscalYearStartMonth);
        columnId = `virtual-${quarter.replace(/\s+/g, "-")}`;
      } catch (error) {
        console.error("Error calculating quarter for opportunity:", opp.id, error);
        columnId = UNASSIGNED_QUARTER_ID;
      }
    } else {
      columnId = UNASSIGNED_QUARTER_ID;
    }

    if (!grouped[columnId]) {
      grouped[columnId] = [];
    }
    grouped[columnId].push(opp);
  });

  return grouped;
}

/**
 * Get a color for a quarter column based on its status.
 * Past quarters get orange/red tones, current gets highlighted blue, future gets standard blue.
 *
 * @param status - Quarter status ("past" | "current" | "future")
 * @param index - Column index (0-based) - used for variety in future quarters
 * @returns Hex color string
 */
function getQuarterColor(status: "past" | "current" | "future", index: number): string {
  if (status === "past") {
    return "#f97316"; // orange-500 - indicates overdue/needs attention
  }

  if (status === "current") {
    return "#3b82f6"; // blue-500 - current quarter stands out
  }

  // Future quarters: progressively lighter shades of blue
  const futureColors = [
    "#60a5fa", // blue-400
    "#93c5fd", // blue-300
    "#bfdbfe", // blue-200
    "#dbeafe", // blue-100
  ];

  return futureColors[index % futureColors.length];
}

/**
 * Check if an opportunity belongs to a specific virtual quarter column.
 *
 * @param opportunity - The opportunity to check
 * @param virtualColumnId - The virtual column ID (e.g., "virtual-Q1-2025")
 * @param fiscalYearStartMonth - Fiscal year start month
 * @returns true if the opportunity belongs to this column
 */
export function isOpportunityInQuarterColumn(
  opportunity: Opportunity,
  virtualColumnId: string,
  fiscalYearStartMonth: number = 1
): boolean {
  if (virtualColumnId === UNASSIGNED_QUARTER_ID) {
    return !opportunity.closeDate;
  }

  if (!opportunity.closeDate) {
    return false;
  }

  try {
    const quarter = getQuarterFromDate(new Date(opportunity.closeDate), fiscalYearStartMonth);
    const expectedId = `virtual-${quarter.replace(/\s+/g, "-")}`;
    return virtualColumnId === expectedId;
  } catch {
    return false;
  }
}

/**
 * Extract the quarter string from a virtual column ID.
 *
 * @param virtualColumnId - Virtual column ID (e.g., "virtual-Q1-2025")
 * @returns Quarter string (e.g., "Q1 2025") or null if invalid
 */
export function getQuarterFromVirtualColumnId(virtualColumnId: string): string | null {
  if (virtualColumnId === UNASSIGNED_QUARTER_ID) {
    return UNASSIGNED_QUARTER_TITLE;
  }

  if (!virtualColumnId.startsWith("virtual-")) {
    return null;
  }

  // Convert "virtual-Q1-2025" to "Q1 2025"
  const quarterPart = virtualColumnId.replace("virtual-", "").replace(/-/g, " ");
  return quarterPart;
}

/**
 * Calculate the close date (last day of quarter) from a virtual column ID.
 * Used when dragging opportunities between quarters in quarterly view.
 *
 * @param virtualColumnId - Virtual column ID (e.g., "virtual-Q1-2025" or "unassigned")
 * @param fiscalYearStartMonth - Fiscal year start month (1=Jan, 2=Feb, etc.)
 * @returns ISO date string for last day of quarter, or null for unassigned
 *
 * @example
 * calculateCloseDateFromVirtualColumn("virtual-Q2-2025", 1) // => "2025-06-30T00:00:00.000Z"
 * calculateCloseDateFromVirtualColumn("unassigned", 1) // => null
 */
export function calculateCloseDateFromVirtualColumn(
  virtualColumnId: string,
  fiscalYearStartMonth: number = 1
): string | null {
  // Handle "Unassigned" column - clear the close date
  if (virtualColumnId === UNASSIGNED_QUARTER_ID) {
    return null;
  }

  // Extract quarter string from virtual column ID
  const quarterString = getQuarterFromVirtualColumnId(virtualColumnId);
  if (!quarterString) {
    console.error(`Invalid virtual column ID: ${virtualColumnId}`);
    return null;
  }

  try {
    // Get the date range for this quarter
    const { end } = getQuarterDateRange(quarterString, fiscalYearStartMonth);

    // Return the last day of the quarter as an ISO string
    return end.toISOString();
  } catch (error) {
    console.error(`Error calculating close date for quarter ${quarterString}:`, error);
    return null;
  }
}

/**
 * Count opportunities that are hidden when using the rolling window view.
 * This includes opportunities outside the visible quarter range.
 *
 * @param opportunities - All opportunities
 * @param visibleColumns - Columns currently visible in the rolling window
 * @param fiscalYearStartMonth - Fiscal year start month (1=Jan, 2=Feb, etc.)
 * @returns Number of opportunities with close dates outside the visible range
 */
export function countHiddenOpportunities(
  opportunities: Opportunity[],
  visibleColumns: SerializedKanbanColumn[],
  fiscalYearStartMonth: number = 1
): number {
  // Get set of visible quarter IDs (excluding "Unassigned")
  const visibleQuarterIds = new Set(
    visibleColumns
      .filter((col) => col.id !== UNASSIGNED_QUARTER_ID)
      .map((col) => col.id)
  );

  // Count opportunities with close dates that don't match any visible quarter
  let hiddenCount = 0;

  opportunities.forEach((opp) => {
    if (opp.closeDate) {
      try {
        const quarter = getQuarterFromDate(new Date(opp.closeDate), fiscalYearStartMonth);
        const quarterId = `virtual-${quarter.replace(/\s+/g, "-")}`;

        if (!visibleQuarterIds.has(quarterId)) {
          hiddenCount++;
        }
      } catch (error) {
        // Ignore errors for invalid dates
      }
    }
  });

  return hiddenCount;
}
