import { z } from "zod";

export const companySettingsSchema = z.object({
  companyName: z.string().max(120).optional().nullable().transform(val => val === "" ? null : val),
  companyWebsite: z.string().url("Please enter a valid URL (e.g., https://example.com)").max(255).optional().nullable().transform(val => val === "" ? null : val).or(z.literal(null)),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
