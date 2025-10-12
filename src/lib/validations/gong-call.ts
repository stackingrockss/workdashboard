import { z } from "zod";

export const gongCallCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Must be a valid URL"),
});

export const gongCallUpdateSchema = gongCallCreateSchema.partial();

export type GongCallCreateInput = z.infer<typeof gongCallCreateSchema>;
export type GongCallUpdateInput = z.infer<typeof gongCallUpdateSchema>;
