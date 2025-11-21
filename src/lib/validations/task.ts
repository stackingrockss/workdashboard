// src/lib/validations/task.ts
// Zod validation schemas for Google Tasks

import { z } from 'zod';

/**
 * Schema for creating a new task list
 */
export const taskListCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'Task list title is required')
    .max(256, 'Task list title must be less than 256 characters'),
});

export type TaskListCreateInput = z.infer<typeof taskListCreateSchema>;

/**
 * Schema for updating a task list
 */
export const taskListUpdateSchema = z.object({
  title: z
    .string()
    .min(1, 'Task list title is required')
    .max(256, 'Task list title must be less than 256 characters'),
});

export type TaskListUpdateInput = z.infer<typeof taskListUpdateSchema>;

/**
 * Schema for creating a new task
 */
export const taskCreateSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(1024, 'Task title must be less than 1024 characters'),
  notes: z
    .string()
    .max(8192, 'Task notes must be less than 8192 characters')
    .optional(),
  due: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional()
    .nullable(),
  opportunityId: z.string().cuid().optional().nullable(),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

/**
 * Schema for updating a task
 */
export const taskUpdateSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(1024, 'Task title must be less than 1024 characters')
    .optional(),
  notes: z
    .string()
    .max(8192, 'Task notes must be less than 8192 characters')
    .optional()
    .nullable(),
  due: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional()
    .nullable(),
  status: z.enum(['needsAction', 'completed']).optional(),
  opportunityId: z.string().cuid().optional().nullable(),
});

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

/**
 * Schema for filtering tasks
 */
export const taskFilterSchema = z.object({
  status: z.enum(['needsAction', 'completed', 'all']).optional(),
  opportunityId: z.string().cuid().optional(),
  dueAfter: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional(),
  dueBefore: z
    .string()
    .datetime({ message: 'Invalid date format' })
    .optional(),
});

export type TaskFilterInput = z.infer<typeof taskFilterSchema>;
