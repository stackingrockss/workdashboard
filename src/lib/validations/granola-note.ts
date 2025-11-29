import { z } from "zod";

export const granolaCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Must be a valid URL"),
  meetingDate: z.string().datetime("Meeting date is required"),
  noteType: z.enum(["customer", "internal", "prospect"], {
    required_error: "Note type is required",
  }).default("customer"),
  calendarEventId: z.string().optional(),
  // Optional transcript text for parsing
  transcriptText: z
    .string()
    .min(100, "Transcript must be at least 100 characters")
    .max(250000, "Transcript must not exceed 250,000 characters")
    .optional(),
});

export const granolaUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  meetingDate: z.string().datetime().optional(),
  noteType: z.enum(["customer", "internal", "prospect"]).optional(),
  calendarEventId: z.string().nullable().optional(),
  transcriptText: z
    .string()
    .min(100, "Transcript must be at least 100 characters")
    .max(250000, "Transcript must not exceed 250,000 characters")
    .nullable()
    .optional(),
});

export type GranolaCreateInput = z.infer<typeof granolaCreateSchema>;
export type GranolaUpdateInput = z.infer<typeof granolaUpdateSchema>;
