import type { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import type {
  RiskLevel,
  RiskCategory,
  RiskSeverity,
  RiskFactor,
  RiskAssessment
} from "@/lib/validations/gong-call";

// Re-export risk assessment types from validation schemas (single source of truth)
export type {
  RiskLevel,
  RiskCategory,
  RiskSeverity,
  RiskFactor,
  RiskAssessment
};

export type NoteType = "customer" | "internal" | "prospect";

export type ParsingStatus = "pending" | "parsing" | "completed" | "failed";

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
  painPoints?: string[] | null;
  goals?: string[] | null;
  parsedPeople?: PersonExtracted[] | null;
  nextSteps?: string[] | null;
  riskAssessment?: RiskAssessment | null;
  whyAndWhyNow?: string[] | null; // Business driver/urgency reasons
  quantifiableMetrics?: string[] | null; // ROI/measurable outcomes
  parsedAt?: string | null; // ISO date string when transcript was parsed
  // Background processing status
  parsingStatus?: ParsingStatus | null;
  parsingError?: string | null;
  // Calendar event association
  calendarEventId?: string | null;
}
