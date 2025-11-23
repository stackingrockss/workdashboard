export type NoteType = "customer" | "internal" | "prospect";

export interface GranolaNote {
  id: string;
  opportunityId: string;
  title: string;
  url: string;
  meetingDate: string; // ISO date string
  noteType: NoteType;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  // Calendar event association
  calendarEventId?: string | null;
}
