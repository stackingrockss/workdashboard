import { z } from "zod";

// Brief section schema
export const briefSectionSchema = z.object({
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

// Brief category enum (matches BriefCategory in Prisma)
export const briefCategorySchema = z.enum([
  "mutual_action_plan",
  "pricing_proposal",
  "business_case",
  "proposal",
  "email",
  "account_plan",
  "executive_summary",
  "internal_prep_doc",
  "notes",
  "general",
  "other",
  "business_impact_proposal",
]);

// Brief scope enum
export const briefScopeSchema = z.enum(["company", "personal"]);

// Create brief schema
export const briefCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  category: briefCategorySchema,
  scope: briefScopeSchema,
  systemInstruction: z
    .string()
    .min(10, "System instruction must be at least 10 characters")
    .max(10000),
  outputFormat: z.string().max(10000).optional(),
  sections: z
    .array(briefSectionSchema)
    .min(1, "At least one section is required")
    .max(20),
  contextConfig: contextConfigSchema.optional(),
  referenceContentIds: z.array(z.string()).optional().default([]),
});

// Update brief schema (all fields optional)
export const briefUpdateSchema = briefCreateSchema.partial();

// Context selection schema for content generation
export const contextSelectionSchema = z.object({
  gongCallIds: z.array(z.string()).optional().default([]),
  granolaNoteIds: z.array(z.string()).optional().default([]),
  googleNoteIds: z.array(z.string()).optional().default([]),
  includeAccountResearch: z.boolean().optional().default(false),
  includeConsolidatedInsights: z.boolean().optional().default(true),
  additionalContext: z.string().max(5000).optional(),
  referenceDocumentIds: z.array(z.string()).optional().default([]),
  referenceContentIds: z.array(z.string()).optional().default([]),
});

// Generate content request schema
// briefId can be either a CUID (database brief) or template-* (template brief)
export const generateContentSchema = z.object({
  briefId: z.string().min(1),
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

// Brief scope for queries (includes "template" and "all")
export const briefScopeQuerySchema = z.enum(["company", "personal", "template", "all"]);

// Query parameters for listing briefs
export const briefListQuerySchema = z.object({
  scope: briefScopeQuerySchema.optional().default("all"),
  category: briefCategorySchema.optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

// Query parameters for listing generated content
export const generatedContentListQuerySchema = z.object({
  briefId: z.string().cuid().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});

// Type exports
export type BriefCreateInput = z.infer<typeof briefCreateSchema>;
export type BriefUpdateInput = z.infer<typeof briefUpdateSchema>;
export type ContextSelectionInput = z.infer<typeof contextSelectionSchema>;
export type GenerateContentInput = z.infer<typeof generateContentSchema>;
export type GeneratedContentUpdateInput = z.infer<typeof generatedContentUpdateSchema>;
export type RestoreVersionInput = z.infer<typeof restoreVersionSchema>;
export type BriefListQuery = z.infer<typeof briefListQuerySchema>;
export type GeneratedContentListQuery = z.infer<typeof generatedContentListQuerySchema>;

// Backwards compatibility aliases (deprecated - remove after full migration)
/** @deprecated Use briefSectionSchema instead */
export const frameworkSectionSchema = briefSectionSchema;
/** @deprecated Use briefCategorySchema instead */
export const frameworkCategorySchema = briefCategorySchema;
/** @deprecated Use briefScopeSchema instead */
export const frameworkScopeSchema = briefScopeSchema;
/** @deprecated Use briefCreateSchema instead */
export const frameworkCreateSchema = briefCreateSchema;
/** @deprecated Use briefUpdateSchema instead */
export const frameworkUpdateSchema = briefUpdateSchema;
/** @deprecated Use briefListQuerySchema instead */
export const frameworkListQuerySchema = briefListQuerySchema;
/** @deprecated Use BriefCreateInput instead */
export type FrameworkCreateInput = BriefCreateInput;
/** @deprecated Use BriefUpdateInput instead */
export type FrameworkUpdateInput = BriefUpdateInput;
/** @deprecated Use BriefListQuery instead */
export type FrameworkListQuery = BriefListQuery;