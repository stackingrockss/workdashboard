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
