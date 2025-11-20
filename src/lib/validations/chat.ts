import { z } from "zod";

/**
 * Maximum message length to prevent abuse and excessive API costs
 */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Maximum conversation history to send with each request
 */
export const MAX_HISTORY_LENGTH = 10;

/**
 * Chat message schema
 */
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

/**
 * Chat request schema
 */
export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`),
  history: z
    .array(chatMessageSchema)
    .max(MAX_HISTORY_LENGTH, `History cannot exceed ${MAX_HISTORY_LENGTH} messages`)
    .optional()
    .default([]),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
