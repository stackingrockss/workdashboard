import { z } from "zod";

// Helper function to normalize and validate URLs
const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  // If URL doesn't start with http:// or https://, prepend https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

export const accountCreateSchema = z.object({
  name: z.string().min(1, "Account name is required").max(200).transform(val => val.trim()),
  website: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === "") return undefined;
      return normalizeUrl(val);
    })
    .refine(
      (val) => {
        if (!val) return true; // Optional field
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Please enter a valid URL" }
    ),
  industry: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  health: z.enum(["good", "at-risk", "critical"]).default("good"),
  notes: z.string().optional(),
  ownerId: z.string().optional(), // Optional, defaults to current user in API
});

export const accountUpdateSchema = accountCreateSchema.partial();

export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
