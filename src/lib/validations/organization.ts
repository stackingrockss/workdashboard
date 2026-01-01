import { z } from 'zod';

// Organization create schema
export const organizationCreateSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  domain: z.string().optional(),
  logo: z.string().url('Invalid logo URL').optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
});

export type OrganizationCreateInput = z.infer<typeof organizationCreateSchema>;

// Organization update schema
export const organizationUpdateSchema = z.object({
  name: z.string().min(1, 'Organization name is required').optional(),
  domain: z.string().optional(),
  logo: z.string().url('Invalid logo URL').nullable().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});

export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;

// Organization settings update schema
export const organizationSettingsUpdateSchema = z.object({
  defaultKanbanView: z.string().optional(),
  defaultKanbanTemplateId: z.string().nullable().optional(),
  allowSelfSignup: z.boolean().optional(),
  allowDomainAutoJoin: z.boolean().optional(),
  autoEnrichContacts: z.boolean().optional(),
});

export type OrganizationSettingsUpdateInput = z.infer<typeof organizationSettingsUpdateSchema>;
