import { z } from "zod";

// Contact role enum
export const contactRoleSchema = z.enum([
  "decision_maker",
  "influencer",
  "champion",
  "blocker",
  "end_user",
]);

// Contact sentiment enum
export const contactSentimentSchema = z.enum([
  "advocate",
  "positive",
  "neutral",
  "negative",
  "unknown",
]);

// Enrichment status enum
export const enrichmentStatusSchema = z.enum([
  "none",
  "pending",
  "enriched",
  "not_found",
  "failed",
]);

// Base contact schema for creation
export const contactCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  title: z.string().max(200).optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  role: contactRoleSchema,
  sentiment: contactSentimentSchema.default("unknown"),
  managerId: z.string().cuid().optional().nullable(),
  positionX: z.number().optional().nullable(),
  positionY: z.number().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // Enrichment fields (typically set by the enrichment service, not user)
  linkedinUrl: z.string().url("Invalid LinkedIn URL").optional().nullable().or(z.literal("")),
  bio: z.string().max(5000).optional().nullable(),
  avatarUrl: z.string().url("Invalid avatar URL").optional().nullable().or(z.literal("")),
  seniority: z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
});

// Schema for updating a contact
export const contactUpdateSchema = contactCreateSchema.partial();

// Schema for updating contact position (for drag-and-drop in org chart)
export const contactPositionUpdateSchema = z.object({
  positionX: z.number(),
  positionY: z.number(),
});

// Schema for per-field merge control when updating existing contacts
export const fieldsToMergeSchema = z.object({
  title: z.boolean().optional(),
  role: z.boolean().optional(),
}).optional();

// Schema for bulk contact import (from parsed transcripts)
export const contactBulkImportItemSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  title: z.string().max(200).optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  role: contactRoleSchema.default("end_user"), // Default to end_user if not provided
  sentiment: contactSentimentSchema.default("unknown"),
  notes: z.string().max(2000).optional().nullable(),
  // Internal fields for duplicate handling
  skipDuplicateCheck: z.boolean().optional().default(false),
  mergeWithExistingId: z.string().cuid().optional().nullable(),
  // Per-field merge control (when mergeWithExistingId is set)
  fieldsToMerge: fieldsToMergeSchema,
});

export const contactBulkImportSchema = z.object({
  contacts: z.array(contactBulkImportItemSchema).min(1, "At least one contact is required").max(50, "Maximum 50 contacts per batch"),
});

// Schema for batch duplicate checking
export const contactBatchDuplicateCheckItemSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
});

export const contactBatchDuplicateCheckSchema = z.object({
  contacts: z.array(contactBatchDuplicateCheckItemSchema).min(1, "At least one contact is required").max(100, "Maximum 100 contacts per batch"),
});

// Types inferred from schemas
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type ContactPositionUpdate = z.infer<typeof contactPositionUpdateSchema>;
export type ContactBulkImportItem = z.infer<typeof contactBulkImportItemSchema>;
export type ContactBulkImportInput = z.infer<typeof contactBulkImportSchema>;
export type ContactBatchDuplicateCheckItem = z.infer<typeof contactBatchDuplicateCheckItemSchema>;
export type ContactBatchDuplicateCheckInput = z.infer<typeof contactBatchDuplicateCheckSchema>;
export type FieldsToMerge = z.infer<typeof fieldsToMergeSchema>;
export type EnrichmentStatus = z.infer<typeof enrichmentStatusSchema>;
