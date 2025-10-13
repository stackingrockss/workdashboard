import { z } from "zod";

export const companySettingsSchema = z.object({
  companyName: z.string().max(120).optional().nullable().transform(val => val === "" ? null : val),
  companyWebsite: z
    .string()
    .optional()
    .nullable()
    .transform(val => {
      // Convert empty string to null
      if (val === "" || !val) return null;

      // If the URL doesn't start with a protocol, add https://
      const trimmedVal = val.trim();
      if (!trimmedVal.match(/^https?:\/\//i)) {
        return `https://${trimmedVal}`;
      }
      return trimmedVal;
    })
    .pipe(
      z.string().url("Please enter a valid URL (e.g., www.example.com or https://example.com)").max(255).nullable()
    )
    .or(z.literal(null)),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
