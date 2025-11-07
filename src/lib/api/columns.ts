import { KanbanColumnConfig } from "@/types/opportunity";
import { ColumnCreateInput, ColumnUpdateInput } from "../validations/column";

const API_BASE = "/api/v1";

export interface GetColumnsResponse {
  columns: KanbanColumnConfig[];
}

export interface GetColumnResponse {
  column: KanbanColumnConfig;
}

export interface CreateColumnResponse {
  column: KanbanColumnConfig;
}

export interface UpdateColumnResponse {
  column: KanbanColumnConfig;
}

export interface DeleteColumnResponse {
  success: boolean;
}

export interface ErrorResponse {
  error: string;
}

export async function getColumns(userId?: string): Promise<KanbanColumnConfig[]> {
  const url = userId
    ? `${API_BASE}/columns?userId=${encodeURIComponent(userId)}`
    : `${API_BASE}/columns`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch columns");
  }

  const data: GetColumnsResponse = await response.json();
  return data.columns;
}

export async function createColumn(input: ColumnCreateInput): Promise<KanbanColumnConfig> {
  const response = await fetch(`${API_BASE}/columns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to create column");
  }

  const data: CreateColumnResponse = await response.json();
  return data.column;
}

export async function createColumnsBatch(inputs: ColumnCreateInput[]): Promise<KanbanColumnConfig[]> {
  const response = await fetch(`${API_BASE}/columns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inputs),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to create columns");
  }

  const data: { columns: KanbanColumnConfig[] } = await response.json();
  return data.columns;
}

export async function updateColumn(
  id: string,
  input: ColumnUpdateInput
): Promise<KanbanColumnConfig> {
  const response = await fetch(`${API_BASE}/columns/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to update column");
  }

  const data: UpdateColumnResponse = await response.json();
  return data.column;
}

export async function deleteColumn(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/columns/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to delete column");
  }
}
