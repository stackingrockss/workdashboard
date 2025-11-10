export type NoteType = "customer" | "internal" | "prospect";

export type ParsingStatus = "pending" | "parsing" | "completed" | "failed";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskCategory =
  | "budget"
  | "timeline"
  | "competition"
  | "technical"
  | "alignment"
  | "resistance";

export type RiskSeverity = "low" | "medium" | "high";

export interface RiskFactor {
  category: RiskCategory;
  description: string;
  severity: RiskSeverity;
  evidence: string; // Quote or context from transcript
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  overallSummary: string;
  recommendedActions: string[];
}

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
  riskAssessment?: unknown; // JSON field - RiskAssessment object
  parsedAt?: string | null; // ISO date string when transcript was parsed
  // Background processing status
  parsingStatus?: ParsingStatus | null;
  parsingError?: string | null;
}
