// src/lib/validations/comment.ts
// Zod validation schemas for comments, mentions, and reactions

import { z } from "zod";

// Text selection/anchoring schema (for Google Docs-style highlighting)
export const textSelectionSchema = z.object({
  selectionType: z.enum(["text", "element"]),
  anchorSelector: z.string(),
  anchorOffset: z.number().int().nonnegative(),
  focusSelector: z.string(),
  focusOffset: z.number().int().nonnegative(),
  selectedText: z.string().max(5000),
});

// Create comment schema
export const commentCreateSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(10000, "Comment too long"),
  entityType: z.string().min(1, "Entity type is required"),
  entityId: z.string().min(1, "Entity ID is required"),
  pageContext: z.string().optional(),
  // Text selection (optional - if null, it's a general comment, not inline)
  textSelection: textSelectionSchema.optional().nullable(),
  // Parent comment ID for replies (flat threading)
  parentId: z.string().optional().nullable(),
  // Mentioned user IDs
  mentionedUserIds: z.array(z.string()).optional().default([]),
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

// Update comment schema (only allow updating content and mentions)
export const commentUpdateSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(10000, "Comment too long"),
  mentionedUserIds: z.array(z.string()).optional().default([]),
});

export type CommentUpdateInput = z.infer<typeof commentUpdateSchema>;

// Resolve comment schema
export const commentResolveSchema = z.object({
  isResolved: z.boolean(),
});

export type CommentResolveInput = z.infer<typeof commentResolveSchema>;

// Add reaction schema
export const reactionCreateSchema = z.object({
  emoji: z.string().min(1, "Emoji is required").max(10, "Invalid emoji"),
});

export type ReactionCreateInput = z.infer<typeof reactionCreateSchema>;

// Query params for fetching comments
export const commentQuerySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  includeResolved: z.coerce.boolean().optional().default(true),
  pageContext: z.string().optional(),
});

export type CommentQueryInput = z.infer<typeof commentQuerySchema>;
