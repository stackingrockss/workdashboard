/**
 * Editor Validation Schemas
 *
 * Zod schemas for AI editor requests and responses.
 */

import { z } from "zod";

/**
 * AI action enum
 */
export const aiActionSchema = z.enum([
  "generate",
  "improve",
  "expand",
  "shorten",
  "tone",
]);

/**
 * Tone option enum
 */
export const toneOptionSchema = z.enum([
  "professional",
  "casual",
  "friendly",
  "executive",
]);

/**
 * AI writing request schema
 */
export const aiWritingRequestSchema = z
  .object({
    action: aiActionSchema,
    text: z.string().max(50000).optional(),
    prompt: z.string().max(2000).optional(),
    tone: toneOptionSchema.optional(),
    opportunityId: z.string().optional(),
    documentContext: z.string().max(10000).optional(),
  })
  .refine(
    (data) => {
      // Generate action requires prompt
      if (data.action === "generate" && !data.prompt) {
        return false;
      }
      // Other actions require text
      if (data.action !== "generate" && !data.text) {
        return false;
      }
      // Tone action requires tone option
      if (data.action === "tone" && !data.tone) {
        return false;
      }
      return true;
    },
    {
      message:
        "Invalid request: 'generate' requires prompt, other actions require text, 'tone' requires tone option",
    }
  );

/**
 * AI sidebar chat request schema
 */
export const aiEditorChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(20)
    .optional()
    .default([]),
  opportunityId: z.string().optional(),
  documentContent: z.string().max(50000).optional(),
});

/**
 * Type exports
 */
export type AIAction = z.infer<typeof aiActionSchema>;
export type ToneOption = z.infer<typeof toneOptionSchema>;
export type AIWritingRequest = z.infer<typeof aiWritingRequestSchema>;
export type AIEditorChatRequest = z.infer<typeof aiEditorChatRequestSchema>;
