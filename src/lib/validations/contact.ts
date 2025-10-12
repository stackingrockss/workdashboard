import { z } from "zod";

// Contact role enum
export const contactRoleSchema = z.enum([
  "decision_maker",
  "influencer",
  "champion",
  "blocker",
  "end_user",
]);

// Contact sentiment enum
export const contactSentimentSchema = z.enum([
  "advocate",
  "positive",
  "neutral",
  "negative",
  "unknown",
]);

// Base contact schema for creation
export const contactCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  title: z.string().max(200).optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable(),
  role: contactRoleSchema,
  sentiment: contactSentimentSchema.default("unknown"),
  managerId: z.string().cuid().optional().nullable(),
  positionX: z.number().optional().nullable(),
  positionY: z.number().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// Schema for updating a contact
export const contactUpdateSchema = contactCreateSchema.partial();

// Schema for updating contact position (for drag-and-drop in org chart)
export const contactPositionUpdateSchema = z.object({
  positionX: z.number(),
  positionY: z.number(),
});

// Types inferred from schemas
export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type ContactPositionUpdate = z.infer<typeof contactPositionUpdateSchema>;
