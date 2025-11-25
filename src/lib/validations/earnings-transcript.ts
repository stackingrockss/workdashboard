import { z } from "zod";

export const earningsTranscriptCreateSchema = z.object({
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  fiscalYear: z.number().int().min(2000).max(2050),
  callDate: z.string().datetime().optional(),
  title: z.string().min(2).max(200).optional(),
  transcriptText: z.string().min(100).optional(),
  source: z
    .enum(["api-ninjas", "finnhub", "financialmodelingprep", "sec-8k", "manual"])
    .default("api-ninjas"),
  sourceUrl: z.string().url().optional(),
});

export const earningsTranscriptUpdateSchema =
  earningsTranscriptCreateSchema.partial();

export const earningsTranscriptLinkSchema = z.object({
  opportunityId: z.string().cuid(),
});

export type EarningsTranscriptCreateInput = z.infer<
  typeof earningsTranscriptCreateSchema
>;
export type EarningsTranscriptUpdateInput = z.infer<
  typeof earningsTranscriptUpdateSchema
>;
export type EarningsTranscriptLinkInput = z.infer<
  typeof earningsTranscriptLinkSchema
>;
