/**
 * TypeScript types for Kanban Views
 * Extends Prisma-generated types with application-specific interfaces
 */

import { KanbanView as PrismaKanbanView, KanbanColumn as PrismaKanbanColumn, ViewType } from "@prisma/client";

// Re-export PrismaKanbanColumn to avoid unused import warning
export type { PrismaKanbanColumn };

/**
 * Prisma query result types for views with included relations
 */
export type PrismaViewWithColumns = PrismaKanbanView & {
  columns: PrismaKanbanColumn[];
};

/**
 * Type for Prisma where clause objects
 */
export type PrismaWhereClause = {
  userId?: string;
  organizationId?: string;
  isActive?: boolean;
  id?: { not?: string };
  name?: string;
};

/**
 * Column configuration with all fields
 */
export interface KanbanColumnConfig {
  id: string;
  title: string;
  order: number;
  color: string | null | undefined;
  viewId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * View with included columns relation
 */
export interface KanbanViewWithColumns extends PrismaKanbanView {
  columns: KanbanColumnConfig[];
}

/**
 * Serializable view (for passing from server to client components)
 */
export interface SerializedKanbanView {
  id: string;
  name: string;
  viewType: ViewType;
  isActive: boolean;
  isDefault: boolean;
  userId: string | null;
  organizationId: string | null;
  lastAccessedAt: string | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  columns: SerializedKanbanColumn[];
}

/**
 * Serializable column
 */
export interface SerializedKanbanColumn {
  id: string;
  title: string;
  order: number;
  color: string | null | undefined;
  viewId: string;
  createdAt: string;
  updatedAt: string;
  subtitle?: string; // Optional subtitle (e.g., month range for quarterly view)
  metadata?: {
    quarterStatus?: "past" | "current" | "future";
  };
}

/**
 * Input for creating a new view
 */
export interface ViewCreateInput {
  name: string;
  viewType: ViewType;
  userId?: string;
  organizationId?: string;
  isDefault?: boolean;
}

/**
 * Input for updating an existing view
 */
export interface ViewUpdateInput {
  name?: string;
  isActive?: boolean;
  isDefault?: boolean;
  lastAccessedAt?: Date;
}

/**
 * Built-in view IDs (virtual views, not stored in database)
 */
export const BUILT_IN_VIEW_IDS = {
  QUARTERLY: "built-in-quarterly",
  STAGES: "built-in-stages",
  FORECAST: "built-in-forecast",
} as const;

/**
 * Check if a view ID belongs to a built-in view
 */
export function isBuiltInView(viewId: string): boolean {
  return Object.values(BUILT_IN_VIEW_IDS).includes(viewId as typeof BUILT_IN_VIEW_IDS[keyof typeof BUILT_IN_VIEW_IDS]);
}

/**
 * Get view type from built-in view ID
 */
export function getViewTypeFromBuiltInId(viewId: string): ViewType | null {
  switch (viewId) {
    case BUILT_IN_VIEW_IDS.QUARTERLY:
      return "quarterly";
    case BUILT_IN_VIEW_IDS.STAGES:
      return "stages";
    case BUILT_IN_VIEW_IDS.FORECAST:
      return "forecast";
    default:
      return null;
  }
}

/**
 * View metadata for display
 */
export interface ViewMetadata {
  id: string;
  name: string;
  viewType: ViewType;
  isBuiltIn: boolean;
  isActive: boolean;
  columnCount: number;
  lastAccessed: Date | null;
}

/**
 * View type labels for UI
 */
export const VIEW_TYPE_LABELS: Record<ViewType, string> = {
  custom: "Custom View",
  quarterly: "Quarterly View",
  stages: "Sales Stages",
  forecast: "Forecast Categories",
};

/**
 * View type descriptions for UI
 */
export const VIEW_TYPE_DESCRIPTIONS: Record<ViewType, string> = {
  custom: "Create and manage your own custom columns",
  quarterly: "Auto-organized by close date quarters (read-only)",
  stages: "Track deals through standard sales stages (read-only)",
  forecast: "Group by forecast confidence level (read-only)",
};

/**
 * Max views per user/organization
 */
export const MAX_VIEWS_PER_USER = 20;

export type { ViewType };
