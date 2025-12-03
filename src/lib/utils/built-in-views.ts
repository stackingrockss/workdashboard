/**
 * Built-in view generators
 * Creates virtual views and columns for quarterly, stages, forecast, closed lost, and customers views
 */

import { SerializedKanbanView, SerializedKanbanColumn, BUILT_IN_VIEW_IDS, ExtendedViewType } from "@/types/view";
import { generateQuarterlyColumns as generateQuarterlyColumnsFromOpportunities } from "@/lib/utils/quarterly-view";
import { generateClosedLostColumns } from "@/lib/utils/closed-lost-view";
import { generateCustomersColumns } from "@/lib/utils/customers-view";
import { Opportunity } from "@/types/opportunity";

/**
 * Generate virtual quarterly columns
 * Delegates to the main quarterly-view generator
 *
 * @param fiscalYearStartMonth - Fiscal year start month (1=Jan, 2=Feb, etc.)
 * @param opportunities - All opportunities (needed for generating columns based on actual data)
 */
export function generateQuarterlyColumns(
  fiscalYearStartMonth: number = 1,
  opportunities: Opportunity[] = []
): SerializedKanbanColumn[] {
  return generateQuarterlyColumnsFromOpportunities(opportunities, fiscalYearStartMonth);
}

/**
 * Generate virtual sales stages columns
 * Based on the OpportunityStage enum (excluding closed stages)
 */
export function generateStagesColumns(): SerializedKanbanColumn[] {
  const stages = [
    { title: "Discovery", color: "#94a3b8" }, // slate-400
    { title: "Demo", color: "#60a5fa" }, // blue-400
    { title: "Validate Solution", color: "#3b82f6" }, // blue-500
    { title: "Decision Maker Approval", color: "#f59e0b" }, // amber-500
    { title: "Contracting", color: "#10b981" }, // emerald-500
  ];

  return stages.map((stage, index) => ({
    id: `virtual-stage-${stage.title.toLowerCase().replace(/\s+/g, "-")}`,
    title: stage.title,
    order: index,
    color: stage.color,
    viewId: BUILT_IN_VIEW_IDS.STAGES,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Generate virtual forecast category columns
 * Based on confidence levels: Pipeline, Best Case, Commit (excluding closed stages)
 */
export function generateForecastColumns(): SerializedKanbanColumn[] {
  const categories = [
    { title: "Pipeline", color: "#94a3b8" }, // slate-400
    { title: "Best Case", color: "#3b82f6" }, // blue-500
    { title: "Commit", color: "#10b981" }, // emerald-500
  ];

  return categories.map((category, index) => ({
    id: `virtual-forecast-${category.title.toLowerCase().replace(/\s+/g, "-")}`,
    title: category.title,
    order: index,
    color: category.color,
    viewId: BUILT_IN_VIEW_IDS.FORECAST,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Get columns for a built-in view type
 */
export function getBuiltInColumns(
  viewType: ExtendedViewType,
  fiscalYearStartMonth?: number,
  opportunities?: Opportunity[]
): SerializedKanbanColumn[] {
  switch (viewType) {
    case "quarterly":
      return generateQuarterlyColumns(fiscalYearStartMonth, opportunities);
    case "stages":
      return generateStagesColumns();
    case "forecast":
      return generateForecastColumns();
    case "closedLost":
      return generateClosedLostColumns();
    case "customers":
      return generateCustomersColumns();
    case "currentQuarter":
      return []; // Current Quarter is list-only view, no Kanban columns
    case "custom":
      return []; // Custom views don't have default columns
    default:
      return [];
  }
}

/**
 * Built-in view type (subset of ExtendedViewType that are built-in)
 */
type BuiltInViewType = "quarterly" | "stages" | "forecast" | "closedLost" | "customers" | "currentQuarter";

/**
 * Generate a complete built-in view object
 */
export function getBuiltInView(
  viewType: BuiltInViewType,
  fiscalYearStartMonth: number = 1,
  userId?: string,
  organizationId?: string
): SerializedKanbanView {
  const viewMap: Record<BuiltInViewType, { id: string; name: string }> = {
    quarterly: {
      id: BUILT_IN_VIEW_IDS.QUARTERLY,
      name: "Quarterly View",
    },
    stages: {
      id: BUILT_IN_VIEW_IDS.STAGES,
      name: "Sales Stages",
    },
    forecast: {
      id: BUILT_IN_VIEW_IDS.FORECAST,
      name: "Forecast Categories",
    },
    closedLost: {
      id: BUILT_IN_VIEW_IDS.CLOSED_LOST,
      name: "Closed Lost",
    },
    customers: {
      id: BUILT_IN_VIEW_IDS.CUSTOMERS,
      name: "Customers",
    },
    currentQuarter: {
      id: BUILT_IN_VIEW_IDS.CURRENT_QUARTER,
      name: "Current Quarter",
    },
  };

  const viewConfig = viewMap[viewType];
  const columns = getBuiltInColumns(viewType, fiscalYearStartMonth);

  return {
    id: viewConfig.id,
    name: viewConfig.name,
    viewType,
    isActive: false,
    isDefault: false,
    userId: userId || null,
    organizationId: organizationId || null,
    lastAccessedAt: null,
    isShared: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    columns,
  };
}

/**
 * Get all built-in views
 */
export function getAllBuiltInViews(
  fiscalYearStartMonth: number = 1,
  userId?: string,
  organizationId?: string
): SerializedKanbanView[] {
  return [
    getBuiltInView("quarterly", fiscalYearStartMonth, userId, organizationId),
    getBuiltInView("currentQuarter", fiscalYearStartMonth, userId, organizationId),
    getBuiltInView("stages", fiscalYearStartMonth, userId, organizationId),
    getBuiltInView("forecast", fiscalYearStartMonth, userId, organizationId),
    getBuiltInView("closedLost", fiscalYearStartMonth, userId, organizationId),
    getBuiltInView("customers", fiscalYearStartMonth, userId, organizationId),
  ];
}
