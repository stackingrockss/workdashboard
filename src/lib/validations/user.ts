import { z } from 'zod';
import { UserRole } from '@prisma/client';

// User role enum schema
export const userRoleSchema = z.nativeEnum(UserRole);

// Task filter preference schema
export const taskPreferencesUpdateSchema = z.object({
  taskFilterPreference: z.enum([
    'today',
    'thisWeekOrNoDueDate',
    'noDueDate',
    'all'
  ]),
});

export type TaskPreferencesUpdateInput = z.infer<typeof taskPreferencesUpdateSchema>;

// User update schema
export const userUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  avatarUrl: z.string().url('Invalid URL').nullable().optional(),
  role: userRoleSchema.optional(),
  managerId: z.string().nullable().optional(),
  annualQuota: z.number().int().positive('Quota must be a positive number').nullable().optional(),
  autoCreateMeetingTasks: z.boolean().optional(),
  taskFilterPreference: z.enum([
    'today',
    'thisWeekOrNoDueDate',
    'noDueDate',
    'all'
  ]).optional(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

// User invite schema
export const userInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: userRoleSchema.default(UserRole.REP),
  managerId: z.string().optional(),
});

export type UserInviteInput = z.infer<typeof userInviteSchema>;

// Bulk user update schema
export const bulkUserUpdateSchema = z.object({
  userIds: z.array(z.string()),
  updates: userUpdateSchema,
});

export type BulkUserUpdateInput = z.infer<typeof bulkUserUpdateSchema>;
