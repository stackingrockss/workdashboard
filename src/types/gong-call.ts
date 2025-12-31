import type { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import type {
  RiskLevel,
  RiskCategory,
  RiskSeverity,
  RiskFactor,
  RiskAssessment,
  CompetitionMention,
  DecisionProcess,
  CallSentiment,
  ConsolidatedCompetition,
  ConsolidatedDecisionProcess,
  ConsolidatedSentimentTrend,
} from "@/lib/validations/gong-call";

// Re-export risk assessment types from validation schemas (single source of truth)
export type {
  RiskLevel,
  RiskCategory,
  RiskSeverity,
  RiskFactor,
  RiskAssessment,
  // Enhanced parsing types
  CompetitionMention,
  DecisionProcess,
  CallSentiment,
  // Consolidated insight types
  ConsolidatedCompetition,
  ConsolidatedDecisionProcess,
  ConsolidatedSentimentTrend,
};

export type NoteType = "customer" | "internal" | "prospect";

export type ParsingStatus = "pending" | "parsing" | "completed" | "failed";

export interface GongCall {
  id: string;
  opportunityId: string | null; // Optional for unlinked calls from Gong sync
  organizationId: string; // Required for multi-tenancy
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
  keyQuotes?: string[] | null; // Verbatim customer statements
  objections?: string[] | null; // Concerns/pushback raised
  competitionMentions?: CompetitionMention[] | null; // Competitors and alternatives
  decisionProcess?: DecisionProcess | null; // Timeline, stakeholders, budget, steps
  callSentiment?: CallSentiment | null; // Overall tone and trajectory
  parsedAt?: string | null; // ISO date string when transcript was parsed
  // Background processing status
  parsingStatus?: ParsingStatus | null;
  parsingError?: string | null;
  // Calendar event association
  calendarEventId?: string | null;
  // Gong API sync fields
  gongCallId?: string | null; // External Gong call ID
  gongUrl?: string | null; // Direct link to Gong
  duration?: number | null; // Duration in seconds
  direction?: string | null; // 'Inbound' | 'Outbound' | 'Conference'
  participants?: unknown | null; // Participant details from Gong
  primaryParticipantEmail?: string | null; // Main external email for matching
  syncedAt?: string | null; // When synced from Gong
  syncSource?: string | null; // 'manual' | 'auto'
}
