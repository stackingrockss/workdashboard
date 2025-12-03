import { z } from "zod";

// Action item status enum
export const mapActionItemStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "delayed",
]);

// Generation status enum
export const mapGenerationStatusSchema = z.enum([
  "pending",
  "generating",
  "completed",
  "failed",
]);

// Single action item schema
export const mapActionItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1, "Description is required"),
  targetDate: z.string().datetime().optional().nullable(),
  completionDate: z.string().datetime().optional().nullable(),
  status: mapActionItemStatusSchema,
  owner: z.string().min(1, "Owner is required"),
  notes: z.string().optional().nullable(),
  order: z.number().int().min(0),
  isWeeklySync: z.boolean().optional(),
});

// Schema for creating/updating a single action item
export const mapActionItemUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  targetDate: z.string().datetime().optional().nullable(),
  completionDate: z.string().datetime().optional().nullable(),
  status: mapActionItemStatusSchema.optional(),
  owner: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  isWeeklySync: z.boolean().optional(),
});

// Schema for generating a new MAP
export const mapGenerateSchema = z.object({
  templateContentId: z.string().optional(),
});

// Schema for updating the entire MAP
export const mapUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  actionItems: z.array(mapActionItemSchema).optional(),
});

// Schema for adding a new action item
export const mapAddActionItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  targetDate: z.string().datetime().optional().nullable(),
  status: mapActionItemStatusSchema.default("not_started"),
  owner: z.string().min(1, "Owner is required"),
  notes: z.string().optional().nullable(),
  isWeeklySync: z.boolean().optional(),
});

// Type exports
export type MAPActionItemStatus = z.infer<typeof mapActionItemStatusSchema>;
export type MapGenerationStatus = z.infer<typeof mapGenerationStatusSchema>;
export type MAPActionItem = z.infer<typeof mapActionItemSchema>;
export type MAPActionItemUpdate = z.infer<typeof mapActionItemUpdateSchema>;
export type MAPGenerateInput = z.infer<typeof mapGenerateSchema>;
export type MAPUpdateInput = z.infer<typeof mapUpdateSchema>;
export type MAPAddActionItemInput = z.infer<typeof mapAddActionItemSchema>;
