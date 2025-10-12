import { z } from "zod";

export const columnCreateSchema = z.object({
  title: z.string().min(1).max(100),
  order: z.number().int().nonnegative(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  userId: z.string().optional(),
});

export const columnUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  order: z.number().int().nonnegative().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
});

export const columnReorderSchema = z.object({
  columnId: z.string(),
  newOrder: z.number().int().nonnegative(),
});

export type ColumnCreateInput = z.infer<typeof columnCreateSchema>;
export type ColumnUpdateInput = z.infer<typeof columnUpdateSchema>;
export type ColumnReorderInput = z.infer<typeof columnReorderSchema>;
