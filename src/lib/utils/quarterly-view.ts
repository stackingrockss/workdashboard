/**
 * Utilities for generating "Quarterly View" - a virtual column mode that dynamically groups
 * opportunities by their calculated quarter instead of using database columns.
 */

import { Opportunity } from "@/types/opportunity";
import { SerializedKanbanColumn } from "@/types/view";
import { getQuarterFromDate } from "./quarter";

export const UNASSIGNED_QUARTER_ID = "unassigned";
export const UNASSIGNED_QUARTER_TITLE = "Unassigned";

/**
 * Generate virtual quarter-based columns from opportunities.
 * These columns are not stored in the database - they're dynamically generated.
 *
 * @param opportunities - All opportunities to analyze
 * @param fiscalYearStartMonth - Fiscal year start month (1=Jan, 2=Feb, etc.)
 * @returns Array of virtual column configs sorted chronologically
 */
export function generateQuarterlyColumns(
  opportunities: Opportunity[],
  fiscalYearStartMonth: number = 1
): SerializedKanbanColumn[] {
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
  const quarters = Array.from(quarterSet).sort((a, b) => {
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

  // Create virtual column configs
  const now = new Date().toISOString();
  const columns: SerializedKanbanColumn[] = quarters.map((quarter, index) => ({
    id: `virtual-${quarter.replace(/\s+/g, "-")}`, // e.g., "virtual-Q1-2025"
    title: quarter,
    order: index,
    color: getQuarterColor(index),
    viewId: "virtual-quarterly",
    createdAt: now,
    updatedAt: now,
  }));

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
 * Get a color for a quarter column based on its index.
 * Returns progressively lighter shades of blue.
 *
 * @param index - Column index (0-based)
 * @returns Hex color string
 */
function getQuarterColor(index: number): string {
  const colors = [
    "#3b82f6", // blue-500
    "#60a5fa", // blue-400
    "#93c5fd", // blue-300
    "#bfdbfe", // blue-200
    "#dbeafe", // blue-100
  ];

  return colors[index % colors.length];
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
