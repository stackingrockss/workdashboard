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

export const gongCallUpdateSchema = gongCallCreateSchema.partial();

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
  recommendedActions: z.array(z.string()).default([]),
});

export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type RiskCategory = z.infer<typeof riskCategorySchema>;
export type RiskSeverity = z.infer<typeof riskSeveritySchema>;
export type RiskFactor = z.infer<typeof riskFactorSchema>;
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;
