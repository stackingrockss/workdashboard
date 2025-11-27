import { z } from "zod";

export const contentCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Must be a valid URL"),
  description: z.string().max(500).optional(),
  body: z.string().max(50000).optional(),
  contentType: z.enum([
    "blog_post",
    "case_study",
    "whitepaper",
    "video",
    "webinar",
    "other",
  ]),
});

export const contentUpdateSchema = contentCreateSchema.partial();

export type ContentCreateInput = z.infer<typeof contentCreateSchema>;
export type ContentUpdateInput = z.infer<typeof contentUpdateSchema>;
