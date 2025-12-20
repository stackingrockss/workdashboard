// src/lib/validations/notification.ts
// Zod schemas for notification API validation

import { z } from "zod";

/**
 * Schema for marking notifications (mentions) as read
 */
export const notificationMarkReadSchema = z.object({
  mentionIds: z.array(z.string()).min(1, "At least one mention ID is required"),
});

export type NotificationMarkReadInput = z.infer<typeof notificationMarkReadSchema>;

/**
 * Schema for query parameters when fetching notifications
 */
export const notificationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  includeRead: z.coerce.boolean().optional().default(false),
});

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;

/**
 * Schema for marking contact notifications as read
 */
export const contactNotificationMarkReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1, "At least one notification ID is required"),
});

export type ContactNotificationMarkReadInput = z.infer<typeof contactNotificationMarkReadSchema>;

/**
 * Schema for query parameters when fetching contact notifications
 */
export const contactNotificationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  includeRead: z.coerce.boolean().optional().default(false),
  opportunityId: z.string().optional(),
});

export type ContactNotificationQueryInput = z.infer<typeof contactNotificationQuerySchema>;

/**
 * Schema for marking parsing complete notifications as read
 */
export const parsingCompleteNotificationMarkReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1, "At least one notification ID is required"),
});

export type ParsingCompleteNotificationMarkReadInput = z.infer<typeof parsingCompleteNotificationMarkReadSchema>;

/**
 * Schema for query parameters when fetching parsing complete notifications
 */
export const parsingCompleteNotificationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  includeRead: z.coerce.boolean().optional().default(false),
});

export type ParsingCompleteNotificationQueryInput = z.infer<typeof parsingCompleteNotificationQuerySchema>;

/**
 * Schema for marking account research notifications as read
 */
export const accountResearchNotificationMarkReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1, "At least one notification ID is required"),
});

export type AccountResearchNotificationMarkReadInput = z.infer<typeof accountResearchNotificationMarkReadSchema>;

/**
 * Schema for query parameters when fetching account research notifications
 */
export const accountResearchNotificationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  includeRead: z.coerce.boolean().optional().default(false),
});

export type AccountResearchNotificationQueryInput = z.infer<typeof accountResearchNotificationQuerySchema>;
