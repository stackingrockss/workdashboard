import { z } from 'zod';
import { UserRole } from '@prisma/client';

// Invitation create schema
export const invitationCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(UserRole).default(UserRole.REP),
  managerId: z.string().optional(),
});

export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;

// Invitation accept schema
export const invitationAcceptSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type InvitationAcceptInput = z.infer<typeof invitationAcceptSchema>;

// Resend invitation schema
export const invitationResendSchema = z.object({
  invitationId: z.string(),
});

export type InvitationResendInput = z.infer<typeof invitationResendSchema>;
