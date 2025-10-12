import { z } from "zod";

export const granolaCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Must be a valid URL"),
});

export const granolaUpdateSchema = granolaCreateSchema.partial();

export type GranolaCreateInput = z.infer<typeof granolaCreateSchema>;
export type GranolaUpdateInput = z.infer<typeof granolaUpdateSchema>;
