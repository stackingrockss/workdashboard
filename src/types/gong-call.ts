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
}
