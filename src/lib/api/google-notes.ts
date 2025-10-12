import { GoogleNote } from "@/types/google-note";
import { GoogleNoteCreateInput } from "../validations/google-note";

const API_BASE = "/api/v1";

export interface GetGoogleNotesResponse {
  notes: GoogleNote[];
}

export interface CreateGoogleNoteResponse {
  note: GoogleNote;
}

export interface DeleteGoogleNoteResponse {
  ok: boolean;
}

export interface ErrorResponse {
  error: string;
}

export async function getGoogleNotes(opportunityId: string): Promise<GoogleNote[]> {
  const response = await fetch(`${API_BASE}/opportunities/${opportunityId}/google-notes`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google notes");
  }

  const data: GetGoogleNotesResponse = await response.json();
  return data.notes;
}

export async function createGoogleNote(
  opportunityId: string,
  input: GoogleNoteCreateInput
): Promise<GoogleNote> {
  const response = await fetch(`${API_BASE}/opportunities/${opportunityId}/google-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to create Google note");
  }

  const data: CreateGoogleNoteResponse = await response.json();
  return data.note;
}

export async function deleteGoogleNote(
  opportunityId: string,
  noteId: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/opportunities/${opportunityId}/google-notes/${noteId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new Error(error.error || "Failed to delete Google note");
  }
}
