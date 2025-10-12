import { z } from "zod";

export const googleNoteCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Must be a valid URL"),
});

export const googleNoteUpdateSchema = googleNoteCreateSchema.partial();

export type GoogleNoteCreateInput = z.infer<typeof googleNoteCreateSchema>;
export type GoogleNoteUpdateInput = z.infer<typeof googleNoteUpdateSchema>;
