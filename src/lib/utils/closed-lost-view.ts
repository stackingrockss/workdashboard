import { Opportunity } from "@/types/opportunity";
import { SerializedKanbanColumn, BUILT_IN_VIEW_IDS } from "@/types/view";

/**
 * Time period buckets for closed lost opportunities
 */
export type ClosedLostPeriod = "thisQuarter" | "lastQuarter" | "older";

/**
 * Converts a closed lost period to its corresponding virtual column ID
 */
export function closedLostPeriodToColumnId(period: ClosedLostPeriod): string {
  const kebabCase = period
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");

  return `virtual-closedlost-${kebabCase}`;
}

/**
 * Generate virtual columns for the Closed Lost view
 * Groups by recency: This Quarter, Last Quarter, Older
 */
export function generateClosedLostColumns(): SerializedKanbanColumn[] {
  const periods = [
    { id: "thisQuarter", title: "This Quarter", color: "#ef4444" }, // red-500
    { id: "lastQuarter", title: "Last Quarter", color: "#f97316" }, // orange-500
    { id: "older", title: "Older", color: "#6b7280" }, // gray-500
  ];

  const now = new Date().toISOString();

  return periods.map((period, index) => ({
    id: `virtual-closedlost-${period.id.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "")}`,
    title: period.title,
    order: index,
    color: period.color,
    viewId: BUILT_IN_VIEW_IDS.CLOSED_LOST,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Get the start of a quarter for a given date
 */
function getQuarterStart(date: Date): Date {
  const month = date.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
}

/**
 * Determine which time period a closed opportunity falls into
 * Based on when the opportunity was last updated (when it was marked as lost)
 */
function getClosedLostPeriod(opportunity: Opportunity): ClosedLostPeriod {
  const updatedAt = new Date(opportunity.updatedAt);
  const now = new Date();

  const thisQuarterStart = getQuarterStart(now);
  const lastQuarterStart = new Date(thisQuarterStart);
  lastQuarterStart.setMonth(lastQuarterStart.getMonth() - 3);

  if (updatedAt >= thisQuarterStart) {
    return "thisQuarter";
  } else if (updatedAt >= lastQuarterStart) {
    return "lastQuarter";
  }
  return "older";
}

/**
 * Groups closed lost opportunities by time period
 * Only includes opportunities with stage = "closedLost"
 */
export function groupOpportunitiesByClosedLost(
  opportunities: Opportunity[]
): Record<string, Opportunity[]> {
  const grouped: Record<string, Opportunity[]> = {
    "virtual-closedlost-this-quarter": [],
    "virtual-closedlost-last-quarter": [],
    "virtual-closedlost-older": [],
  };

  // Only include closedLost opportunities
  const closedLostOpps = opportunities.filter(
    (opp) => opp.stage === "closedLost"
  );

  closedLostOpps.forEach((opp) => {
    const period = getClosedLostPeriod(opp);
    const columnId = closedLostPeriodToColumnId(period);

    if (grouped[columnId]) {
      grouped[columnId].push(opp);
    }
  });

  return grouped;
}

/**
 * Extracts the period from a virtual column ID
 */
export function columnIdToClosedLostPeriod(
  columnId: string
): ClosedLostPeriod | null {
  if (!columnId.startsWith("virtual-closedlost-")) {
    return null;
  }

  const kebabCase = columnId.replace("virtual-closedlost-", "");

  // Convert kebab-case to camelCase
  const camelCase = kebabCase.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

  const validPeriods: ClosedLostPeriod[] = ["thisQuarter", "lastQuarter", "older"];
  if (validPeriods.includes(camelCase as ClosedLostPeriod)) {
    return camelCase as ClosedLostPeriod;
  }

  return null;
}
