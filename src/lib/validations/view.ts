/**
 * Zod validation schemas for Kanban Views
 * Used for API request validation and form handling
 */

import { z } from "zod";

/**
 * View type enum schema
 */
export const viewTypeSchema = z.enum(["custom", "quarterly", "stages", "forecast"]);

/**
 * View name validation rules:
 * - Required
 * - 1-50 characters
 * - No leading/trailing whitespace
 */
export const viewNameSchema = z
  .string()
  .min(1, "View name is required")
  .max(50, "View name must be 50 characters or less")
  .trim()
  .refine((name) => name.length > 0, {
    message: "View name cannot be empty",
  });

/**
 * Schema for creating a new view
 */
export const viewCreateSchema = z.object({
  name: viewNameSchema,
  viewType: viewTypeSchema,
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

/**
 * Schema for updating an existing view
 */
export const viewUpdateSchema = z.object({
  name: viewNameSchema.optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Schema for activating a view (sets lastAccessedAt)
 */
export const viewActivateSchema = z.object({
  viewId: z.string().cuid("Invalid view ID format"),
});

/**
 * Schema for duplicating a view
 */
export const viewDuplicateSchema = z.object({
  newName: viewNameSchema,
  includeColumns: z.boolean().optional().default(true),
});

/**
 * Schema for batch column creation (used when creating view from template)
 */
export const batchColumnCreateSchema = z.object({
  columns: z
    .array(
      z.object({
        title: z.string().min(1, "Column title is required").max(100, "Column title too long"),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
        order: z.number().int().min(0),
      })
    )
    .max(20, "Cannot create more than 20 columns at once"),
});

/**
 * Schema for view query parameters
 */
export const viewQuerySchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  viewType: viewTypeSchema.optional(),
  includeColumns: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  activeOnly: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

/**
 * Type exports for TypeScript inference
 */
export type ViewCreateInput = z.infer<typeof viewCreateSchema>;
export type ViewUpdateInput = z.infer<typeof viewUpdateSchema>;
export type ViewActivateInput = z.infer<typeof viewActivateSchema>;
export type ViewDuplicateInput = z.infer<typeof viewDuplicateSchema>;
export type BatchColumnCreateInput = z.infer<typeof batchColumnCreateSchema>;
export type ViewQueryParams = z.infer<typeof viewQuerySchema>;
