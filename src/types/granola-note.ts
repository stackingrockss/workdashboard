import type { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import type {
  RiskAssessment,
} from "@/types/gong-call";

export type NoteType = "customer" | "internal" | "prospect";

export type ParsingStatus = "pending" | "parsing" | "completed" | "failed";

// Re-export shared types
export type { PersonExtracted, RiskAssessment };

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
  // Parsed transcript fields
  transcriptText?: string | null;
  painPoints?: string[] | null;
  goals?: string[] | null;
  parsedPeople?: PersonExtracted[] | null;
  nextSteps?: string[] | null;
  riskAssessment?: RiskAssessment | null;
  parsedAt?: string | null; // ISO date string when transcript was parsed
  // Background processing status
  parsingStatus?: ParsingStatus | null;
  parsingError?: string | null;
}
