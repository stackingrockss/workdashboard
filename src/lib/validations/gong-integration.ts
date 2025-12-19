import { z } from 'zod';

/**
 * Schema for creating/updating Gong integration credentials
 */
export const gongIntegrationCreateSchema = z.object({
  accessKey: z
    .string()
    .min(1, 'Access Key is required')
    .max(500, 'Access Key is too long'),
  accessKeySecret: z
    .string()
    .min(1, 'Access Key Secret is required')
    .max(500, 'Access Key Secret is too long'),
});

export type GongIntegrationCreateInput = z.infer<typeof gongIntegrationCreateSchema>;

/**
 * Schema for testing Gong credentials (same as create)
 */
export const gongIntegrationTestSchema = gongIntegrationCreateSchema;

export type GongIntegrationTestInput = z.infer<typeof gongIntegrationTestSchema>;

/**
 * Schema for triggering a manual sync
 */
export const gongSyncTriggerSchema = z.object({
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  fullSync: z.boolean().optional().default(false),
});

export type GongSyncTriggerInput = z.infer<typeof gongSyncTriggerSchema>;

/**
 * Schema for updating Gong integration settings
 */
export const gongIntegrationUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  syncIntervalMinutes: z
    .number()
    .min(15, 'Minimum sync interval is 15 minutes')
    .max(1440, 'Maximum sync interval is 24 hours')
    .optional(),
});

export type GongIntegrationUpdateInput = z.infer<typeof gongIntegrationUpdateSchema>;
