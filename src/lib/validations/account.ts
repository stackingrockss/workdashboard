import { z } from "zod";

export const accountCreateSchema = z.object({
  name: z.string().min(1, "Account name is required").max(200),
  industry: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  health: z.enum(["good", "at-risk", "critical"]).default("good"),
  notes: z.string().optional(),
});

export const accountUpdateSchema = accountCreateSchema.partial();

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
