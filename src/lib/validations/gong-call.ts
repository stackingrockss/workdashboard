import { z } from "zod";

export const gongCallCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Must be a valid URL"),
  meetingDate: z.string().datetime("Meeting date is required"),
  noteType: z.enum(["customer", "internal", "prospect"], {
    required_error: "Note type is required",
  }).default("customer"),
  transcriptText: z
    .string()
    .min(100, "Transcript must be at least 100 characters")
    .max(250000, "Transcript must not exceed 250,000 characters")
    .optional(),
  calendarEventId: z.string().optional(),
});

// Schema for insight arrays (pain points, goals, next steps)
export const insightArraySchema = z.array(z.string().max(1000)).optional();

export const gongCallUpdateSchema = gongCallCreateSchema.partial().extend({
  // Allow updating AI-generated insights
  painPoints: insightArraySchema,
  goals: insightArraySchema,
  nextSteps: insightArraySchema,
});

export type GongCallCreateInput = z.infer<typeof gongCallCreateSchema>;
export type GongCallUpdateInput = z.infer<typeof gongCallUpdateSchema>;

// Risk Assessment Schemas
export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const riskCategorySchema = z.enum([
  "budget",
  "timeline",
  "competition",
  "technical",
  "alignment",
  "resistance",
]);

export const riskSeveritySchema = z.enum(["low", "medium", "high"]);

export const riskFactorSchema = z.object({
  category: riskCategorySchema,
  description: z.string().min(1),
  severity: riskSeveritySchema,
  evidence: z.string().min(1),
});

export const riskAssessmentSchema = z.object({
  riskLevel: riskLevelSchema,
  riskFactors: z.array(riskFactorSchema),
  overallSummary: z.string().min(1),
});

export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type RiskCategory = z.infer<typeof riskCategorySchema>;
export type RiskSeverity = z.infer<typeof riskSeveritySchema>;
export type RiskFactor = z.infer<typeof riskFactorSchema>;
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;

// Why and Why Now / Quantifiable Metrics Schemas
export const whyAndWhyNowSchema = z.array(z.string().max(500)).default([]);
export const quantifiableMetricsSchema = z.array(z.string().max(500)).default([]);

export type WhyAndWhyNow = z.infer<typeof whyAndWhyNowSchema>;
export type QuantifiableMetrics = z.infer<typeof quantifiableMetricsSchema>;

// ============================================================================
// Enhanced Parsing Fields (Key Quotes, Objections, Competition, etc.)
// ============================================================================

// Key Quotes - Verbatim customer statements
export const keyQuotesSchema = z.array(z.string().max(1000)).default([]);
export type KeyQuotes = z.infer<typeof keyQuotesSchema>;

// Objections - Concerns and pushback raised
export const objectionsSchema = z.array(z.string().max(500)).default([]);
export type Objections = z.infer<typeof objectionsSchema>;

// Competition Mentions - Competitors and alternatives discussed
export const competitionSentimentSchema = z.enum(["positive", "negative", "neutral"]);
export type CompetitionSentiment = z.infer<typeof competitionSentimentSchema>;

export const competitionMentionSchema = z.object({
  competitor: z.string().min(1), // Named vendor, "status quo", "build in-house", etc.
  context: z.string().min(1),    // What was said about them
  sentiment: competitionSentimentSchema, // Customer's view
});
export type CompetitionMention = z.infer<typeof competitionMentionSchema>;

export const competitionMentionsSchema = z.array(competitionMentionSchema).default([]);
export type CompetitionMentions = z.infer<typeof competitionMentionsSchema>;

// Decision Process - Timeline, stakeholders, budget, approval steps
export const decisionProcessSchema = z.object({
  timeline: z.string().nullable(),        // "Q1 2025", "end of year", etc.
  stakeholders: z.array(z.string()),      // People involved in decision
  budgetContext: z.string().nullable(),   // Budget status/range (simple string)
  approvalSteps: z.array(z.string()),     // Steps to get to yes
});
export type DecisionProcess = z.infer<typeof decisionProcessSchema>;

// Call Sentiment - Overall tone and trajectory
export const sentimentOverallSchema = z.enum(["positive", "neutral", "negative"]);
export const sentimentMomentumSchema = z.enum(["accelerating", "steady", "stalling"]);
export const sentimentEnthusiasmSchema = z.enum(["high", "medium", "low"]);

export const callSentimentSchema = z.object({
  overall: sentimentOverallSchema,      // How did the call feel?
  momentum: sentimentMomentumSchema,    // Is the deal moving forward?
  enthusiasm: sentimentEnthusiasmSchema, // How engaged was the prospect?
});
export type CallSentiment = z.infer<typeof callSentimentSchema>;

// ============================================================================
// Consolidated Insights Types (for cross-call aggregation)
// ============================================================================

export const consolidatedCompetitionSchema = z.object({
  competitors: z.array(z.string()),              // All competitors mentioned
  primaryThreat: z.string().nullable(),          // Most serious competitor
  customerSentiment: z.string(),                 // Overall view of alternatives
});
export type ConsolidatedCompetition = z.infer<typeof consolidatedCompetitionSchema>;

export const consolidatedDecisionProcessSchema = z.object({
  timeline: z.string().nullable(),               // Most recent/accurate timeline
  keyStakeholders: z.array(z.string()),          // Consolidated decision makers
  budgetStatus: z.string().nullable(),           // Latest budget context
  remainingSteps: z.array(z.string()),           // What still needs to happen
});
export type ConsolidatedDecisionProcess = z.infer<typeof consolidatedDecisionProcessSchema>;

export const sentimentTrajectorySchema = z.enum(["improving", "stable", "declining"]);
export const consolidatedSentimentTrendSchema = z.object({
  trajectory: sentimentTrajectorySchema,         // Improving, stable, or declining
  currentState: sentimentOverallSchema,          // Current sentiment state
  summary: z.string(),                           // Brief narrative of sentiment evolution
});
export type ConsolidatedSentimentTrend = z.infer<typeof consolidatedSentimentTrendSchema>;
