/**
 * Built-in view generators
 * Creates virtual views and columns for quarterly, stages, and forecast views
 */

import { ViewType } from "@prisma/client";
import { SerializedKanbanView, SerializedKanbanColumn, BUILT_IN_VIEW_IDS } from "@/types/view";
import { generateQuarterlyColumns as generateQuarterlyColumnsFromOpportunities } from "@/lib/utils/quarterly-view";
import { Opportunity } from "@/types/opportunity";

/**
 * Generate virtual quarterly columns
 * Delegates to the main quarterly-view generator with rolling window support
 *
 * @param fiscalYearStartMonth - Fiscal year start month (1=Jan, 2=Feb, etc.)
 * @param showAllQuarters - If true, show all quarters with opportunities. If false, use rolling window
 * @param opportunities - All opportunities (needed for generating columns based on actual data)
 */
export function generateQuarterlyColumns(
  fiscalYearStartMonth: number = 1,
  showAllQuarters: boolean = false,
  opportunities: Opportunity[] = []
): SerializedKanbanColumn[] {
  return generateQuarterlyColumnsFromOpportunities(opportunities, fiscalYearStartMonth, showAllQuarters);
}

/**
 * Generate virtual sales stages columns
 * Based on the OpportunityStage enum
 */
export function generateStagesColumns(): SerializedKanbanColumn[] {
  const stages = [
    { title: "Discovery", color: "#94a3b8" }, // slate-400
    { title: "Demo", color: "#60a5fa" }, // blue-400
    { title: "Validate Solution", color: "#3b82f6" }, // blue-500
    { title: "Decision Maker Approval", color: "#f59e0b" }, // amber-500
    { title: "Contracting", color: "#10b981" }, // emerald-500
    { title: "Closed Won", color: "#22c55e" }, // green-500
    { title: "Closed Lost", color: "#ef4444" }, // red-500
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
 * Based on confidence levels: Pipeline, Best Case, Commit, Won, Lost
 */
export function generateForecastColumns(): SerializedKanbanColumn[] {
  const categories = [
    { title: "Pipeline", color: "#94a3b8" }, // slate-400
    { title: "Best Case", color: "#3b82f6" }, // blue-500
    { title: "Commit", color: "#10b981" }, // emerald-500
    { title: "Closed Won", color: "#22c55e" }, // green-500
    { title: "Closed Lost", color: "#ef4444" }, // red-500
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
  viewType: ViewType,
  fiscalYearStartMonth?: number,
  showAllQuarters?: boolean,
  opportunities?: Opportunity[]
): SerializedKanbanColumn[] {
  switch (viewType) {
    case "quarterly":
      return generateQuarterlyColumns(fiscalYearStartMonth, showAllQuarters, opportunities);
    case "stages":
      return generateStagesColumns();
    case "forecast":
      return generateForecastColumns();
    case "custom":
      return []; // Custom views don't have default columns
    default:
      return [];
  }
}

/**
 * Generate a complete built-in view object
 */
export function getBuiltInView(
  viewType: "quarterly" | "stages" | "forecast",
  fiscalYearStartMonth: number = 1,
  userId?: string,
  organizationId?: string
): SerializedKanbanView {
  const viewMap = {
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
    getBuiltInView("stages", fiscalYearStartMonth, userId, organizationId),
    getBuiltInView("forecast", fiscalYearStartMonth, userId, organizationId),
  ];
}
