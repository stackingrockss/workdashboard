import { z } from "zod";

export const secFilingCreateSchema = z.object({
  filingType: z.enum(["10-K", "10-Q", "8-K"]),
  fiscalYear: z.number().int().min(2000).max(2050),
  fiscalPeriod: z.enum(["FY", "Q1", "Q2", "Q3", "Q4"]).optional(),
});

export const secFilingUpdateSchema = secFilingCreateSchema.partial();

export type SecFilingCreateInput = z.infer<typeof secFilingCreateSchema>;
export type SecFilingUpdateInput = z.infer<typeof secFilingUpdateSchema>;
