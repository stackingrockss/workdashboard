import { z } from "zod";
import { contextSelectionSchema, briefCategorySchema } from "./brief";

// Document generation status enum
export const documentGenerationStatusSchema = z.enum([
  "pending",
  "generating",
  "completed",
  "failed",
]);

// MAP action item status enum
export const mapActionItemStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "delayed",
]);

// MAP action item schema
export const mapActionItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "Description is required"),
  targetDate: z.string().nullable().optional(),
  completionDate: z.string().nullable().optional(),
  status: mapActionItemStatusSchema,
  owner: z.string().min(1, "Owner is required"),
  notes: z.string().nullable().optional(),
  order: z.number().int().min(0),
  isWeeklySync: z.boolean().optional(),
});

// MAP structured data schema
export const mapStructuredDataSchema = z.object({
  actionItems: z.array(mapActionItemSchema),
  sourceCallCount: z.number().int().optional(),
  templateContentId: z.string().optional(),
});

// Create document schema
export const documentCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: briefCategorySchema,
  content: z.string().optional(),
  structuredData: mapStructuredDataSchema.optional(),
  // For AI generation
  briefId: z.string().cuid().optional(),
  contextSelection: contextSelectionSchema.optional(),
  // For MAP generation
  generateFromMeetings: z.boolean().optional(),
  templateContentId: z.string().optional(),
});

// Update document schema
export const documentUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  structuredData: mapStructuredDataSchema.optional(),
});

// Regenerate document schema
export const documentRegenerateSchema = z.object({
  contextSelection: contextSelectionSchema,
});

// Restore version schema
export const documentRestoreVersionSchema = z.object({
  versionId: z.string().cuid(),
});

// Query parameters for listing documents
export const documentListQuerySchema = z.object({
  category: briefCategorySchema.optional(),
  briefId: z.string().cuid().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

// Type exports
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
export type DocumentRegenerateInput = z.infer<typeof documentRegenerateSchema>;
export type DocumentRestoreVersionInput = z.infer<typeof documentRestoreVersionSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
export type MAPActionItemInput = z.infer<typeof mapActionItemSchema>;
export type MAPStructuredDataInput = z.infer<typeof mapStructuredDataSchema>;
