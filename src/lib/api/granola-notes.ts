import { GranolaNote } from "@/types/granola-note";
import { GranolaCreateInput } from "../validations/granola-note";

const API_BASE = "/api/v1";

export interface GetGranolaNotesResponse {
  notes: GranolaNote[];
}

export interface CreateGranolaResponse {
  note: GranolaNote;
}

export interface DeleteGranolaResponse {
  ok: boolean;
}

export interface ErrorResponse {
  error: string;
}

export async function getGranolaNotes(opportunityId: string): Promise<GranolaNote[]> {
  const response = await fetch(`${API_BASE}/opportunities/${opportunityId}/granola-notes`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Granola notes");
  }

  const data: GetGranolaNotesResponse = await response.json();
  return data.notes;
}

export async function createGranolaNote(
  opportunityId: string,
  input: GranolaCreateInput
): Promise<GranolaNote> {
  const response = await fetch(`${API_BASE}/opportunities/${opportunityId}/granola-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to create Granola note");
  }

  const data: CreateGranolaResponse = await response.json();
  return data.note;
}

export async function deleteGranolaNote(
  opportunityId: string,
  noteId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/opportunities/${opportunityId}/granola-notes/${noteId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to delete Granola note");
  }
}
