import { z } from "zod";

// Framework section schema
export const frameworkSectionSchema = z.object({
  title: z.string().min(1, "Section title is required").max(100),
  description: z.string().max(500).optional(),
  required: z.boolean().default(false),
});

// Context config schema
export const contextConfigSchema = z.object({
  meetings: z.boolean().optional().default(true),
  files: z.boolean().optional().default(false),
  notes: z.boolean().optional().default(true),
  accountResearch: z.boolean().optional().default(false),
});

// Framework category enum
export const frameworkCategorySchema = z.enum([
  "mutual_action_plan",
  "business_case",
  "proposal",
  "email",
  "account_plan",
  "executive_summary",
  "internal_prep_doc",
  "notes",
  "general",
  "other",
]);

// Framework scope enum
export const frameworkScopeSchema = z.enum(["company", "personal"]);

// Create framework schema
export const frameworkCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  category: frameworkCategorySchema,
  scope: frameworkScopeSchema,
  systemInstruction: z
    .string()
    .min(10, "System instruction must be at least 10 characters")
    .max(10000),
  outputFormat: z.string().max(5000).optional(),
  sections: z
    .array(frameworkSectionSchema)
    .min(1, "At least one section is required")
    .max(20),
  contextConfig: contextConfigSchema.optional(),
});

// Update framework schema (all fields optional)
export const frameworkUpdateSchema = frameworkCreateSchema.partial();

// Context selection schema for content generation
export const contextSelectionSchema = z.object({
  gongCallIds: z.array(z.string()).optional().default([]),
  granolaNoteIds: z.array(z.string()).optional().default([]),
  googleNoteIds: z.array(z.string()).optional().default([]),
  includeAccountResearch: z.boolean().optional().default(false),
  includeConsolidatedInsights: z.boolean().optional().default(true),
  additionalContext: z.string().max(5000).optional(),
});

// Generate content request schema
export const generateContentSchema = z.object({
  frameworkId: z.string().cuid(),
  contextSelection: contextSelectionSchema,
});

// Update generated content schema
export const generatedContentUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
});

// Restore version schema
export const restoreVersionSchema = z.object({
  versionId: z.string().cuid(),
});

// Query parameters for listing frameworks
export const frameworkListQuerySchema = z.object({
  scope: z.enum(["company", "personal", "all"]).optional().default("all"),
  category: frameworkCategorySchema.optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

// Query parameters for listing generated content
export const generatedContentListQuerySchema = z.object({
  frameworkId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

// Type exports
export type FrameworkCreateInput = z.infer<typeof frameworkCreateSchema>;
export type FrameworkUpdateInput = z.infer<typeof frameworkUpdateSchema>;
export type ContextSelectionInput = z.infer<typeof contextSelectionSchema>;
export type GenerateContentInput = z.infer<typeof generateContentSchema>;
export type GeneratedContentUpdateInput = z.infer<typeof generatedContentUpdateSchema>;
export type RestoreVersionInput = z.infer<typeof restoreVersionSchema>;
export type FrameworkListQuery = z.infer<typeof frameworkListQuerySchema>;
export type GeneratedContentListQuery = z.infer<typeof generatedContentListQuerySchema>;
