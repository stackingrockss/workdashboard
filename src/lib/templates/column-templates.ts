/**
 * Column template system for quickly setting up Kanban board columns.
 * Provides pre-defined templates for common workflows: quarterly forecasting, sales stages, and forecast categories.
 */

import { getNextQuarters } from "@/lib/utils/quarter";
import { ColumnCreateInput } from "@/lib/validations/column";

export type ColumnTemplateType = "quarterly" | "stages" | "forecastCategories" | "blank";

export interface ColumnTemplate {
  id: ColumnTemplateType;
  name: string;
  description: string;
  icon: string; // lucide-react icon name
  columns: Omit<ColumnCreateInput, "order">[];
}

/**
 * Get all available column templates
 */
export function getColumnTemplates(fiscalYearStartMonth: number = 1): ColumnTemplate[] {
  return [
    getQuarterlyTemplate(fiscalYearStartMonth),
    getStagesTemplate(),
    getForecastCategoriesTemplate(),
    getBlankTemplate(),
  ];
}

/**
 * Get template by ID
 */
export function getTemplateById(
  id: ColumnTemplateType,
  fiscalYearStartMonth: number = 1
): ColumnTemplate {
  const templates = getColumnTemplates(fiscalYearStartMonth);
  const template = templates.find((t) => t.id === id);
  if (!template) {
    throw new Error(`Template ${id} not found`);
  }
  return template;
}

/**
 * Quarterly Columns Template
 * Creates columns for current quarter + next 3 quarters
 * Ideal for: Sales forecasting, time-based pipeline tracking
 * Note: This creates real database columns. Use "Quarterly View" mode for dynamic virtual columns.
 */
export function getQuarterlyTemplate(fiscalYearStartMonth: number = 1): ColumnTemplate {
  const quarterStrings = getNextQuarters(4, fiscalYearStartMonth);

  // Color scheme for quarters (progressive shades of blue)
  const quarterColors = ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];

  return {
    id: "quarterly",
    name: "Quarter Columns",
    description: "Create quarter columns for time-based tracking (current + next 3 quarters)",
    icon: "CalendarDays",
    columns: quarterStrings.map((quarter, index) => ({
      title: quarter,
      color: quarterColors[index],
    })),
  };
}

/**
 * Sales Stages Template
 * Creates columns for standard sales methodology stages
 * Ideal for: Stage-based pipeline management, deal progression tracking
 */
export function getStagesTemplate(): ColumnTemplate {
  return {
    id: "stages",
    name: "Sales Stages",
    description: "Track deals through standard sales process stages",
    icon: "TrendingUp",
    columns: [
      {
        title: "Discovery",
        color: "#94a3b8",
      },
      {
        title: "Demo",
        color: "#60a5fa",
      },
      {
        title: "Validate Solution",
        color: "#3b82f6",
      },
      {
        title: "Decision Maker Approval",
        color: "#f59e0b",
      },
      {
        title: "Contracting",
        color: "#10b981",
      },
      {
        title: "Closed Won",
        color: "#22c55e",
      },
      {
        title: "Closed Lost",
        color: "#ef4444",
      },
    ],
  };
}

/**
 * Forecast Categories Template
 * Creates columns based on forecast confidence levels
 * Ideal for: Sales forecasting, pipeline categorization by confidence
 */
export function getForecastCategoriesTemplate(): ColumnTemplate {
  return {
    id: "forecastCategories",
    name: "Forecast Categories",
    description: "Group opportunities by forecast confidence (Pipeline, Best Case, Commit)",
    icon: "Target",
    columns: [
      {
        title: "Pipeline",
        color: "#94a3b8",
      },
      {
        title: "Best Case",
        color: "#3b82f6",
      },
      {
        title: "Commit",
        color: "#10b981",
      },
      {
        title: "Closed Won",
        color: "#22c55e",
      },
      {
        title: "Closed Lost",
        color: "#ef4444",
      },
    ],
  };
}

/**
 * Blank Template
 * Starts with no columns - user creates their own
 * Ideal for: Custom workflows, non-standard processes
 */
export function getBlankTemplate(): ColumnTemplate {
  return {
    id: "blank",
    name: "Start Blank",
    description: "Start with no columns and build your own custom workflow",
    icon: "LayoutGrid",
    columns: [],
  };
}

/**
 * Convert template columns to API-ready format with order
 */
export function prepareTemplateForCreation(template: ColumnTemplate): ColumnCreateInput[] {
  return template.columns.map((col, index) => ({
    ...col,
    order: index,
  }));
}
