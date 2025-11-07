/**
 * Client-side API functions for Kanban View management
 * Used by React components to interact with view endpoints
 */

import {
  ViewCreateInput,
  ViewUpdateInput,
  ViewDuplicateInput,
  BatchColumnCreateInput,
} from "@/lib/validations/view";
import { SerializedKanbanView } from "@/types/view";

/**
 * Fetch all views for a user or organization
 */
export async function fetchViews(params?: {
  userId?: string;
  organizationId?: string;
  includeColumns?: boolean;
}): Promise<SerializedKanbanView[]> {
  const searchParams = new URLSearchParams();
  if (params?.userId) searchParams.set("userId", params.userId);
  if (params?.organizationId) searchParams.set("organizationId", params.organizationId);
  if (params?.includeColumns !== undefined) {
    searchParams.set("includeColumns", String(params.includeColumns));
  }

  const response = await fetch(`/api/v1/views?${searchParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch views");
  }

  const data = await response.json();
  return data.views;
}

/**
 * Fetch a single view by ID
 */
export async function fetchView(viewId: string): Promise<SerializedKanbanView> {
  const response = await fetch(`/api/v1/views/${viewId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch view");
  }

  const data = await response.json();
  return data.view;
}

/**
 * Create a new view
 */
export async function createView(input: ViewCreateInput): Promise<SerializedKanbanView> {
  const response = await fetch("/api/v1/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create view");
  }

  const data = await response.json();
  return data.view;
}

/**
 * Update an existing view
 */
export async function updateView(
  viewId: string,
  input: ViewUpdateInput
): Promise<SerializedKanbanView> {
  const response = await fetch(`/api/v1/views/${viewId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update view");
  }

  const data = await response.json();
  return data.view;
}

/**
 * Delete a view
 */
export async function deleteView(viewId: string): Promise<void> {
  const response = await fetch(`/api/v1/views/${viewId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete view");
  }
}

/**
 * Activate a view (sets as active and updates lastAccessedAt)
 */
export async function activateView(viewId: string): Promise<SerializedKanbanView> {
  const response = await fetch(`/api/v1/views/${viewId}/activate`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to activate view");
  }

  const data = await response.json();
  return data.view;
}

/**
 * Duplicate a view (creates a copy with optional new name)
 */
export async function duplicateView(
  viewId: string,
  input: ViewDuplicateInput
): Promise<SerializedKanbanView> {
  const response = await fetch(`/api/v1/views/${viewId}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to duplicate view");
  }

  const data = await response.json();
  return data.view;
}

/**
 * Create columns for a view (batch creation, used with templates)
 */
export async function createViewColumns(
  viewId: string,
  input: BatchColumnCreateInput
): Promise<void> {
  const response = await fetch(`/api/v1/views/${viewId}/columns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create columns");
  }
}
