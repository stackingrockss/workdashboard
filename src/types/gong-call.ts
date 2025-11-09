export type NoteType = "customer" | "internal" | "prospect";

export interface GongCall {
  id: string;
  opportunityId: string;
  title: string;
  url: string;
  meetingDate: string; // ISO date string
  noteType: NoteType;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  // Parsed transcript fields
  transcriptText?: string | null;
  painPoints?: unknown; // JSON field - array of strings
  goals?: unknown; // JSON field - array of strings
  parsedPeople?: unknown; // JSON field - array of PersonExtracted objects
  nextSteps?: unknown; // JSON field - array of strings
  parsedAt?: string | null; // ISO date string when transcript was parsed
}
