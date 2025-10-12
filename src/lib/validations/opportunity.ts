import { z } from "zod";

const baseOpportunitySchema = z.object({
  name: z.string().min(2).max(120),
  // Support both old account field and new accountId for backward compatibility
  account: z.string().min(1).max(120).optional(),
  accountId: z.string().optional(),
  amountArr: z.number().int().nonnegative(),
  probability: z.number().int().min(0).max(100),
  nextStep: z.string().max(500).optional().nullable(),
  closeDate: z.string().datetime().optional().nullable(),
  quarter: z.string().max(20).optional().nullable(),
  stage: z.enum([
    "prospect",
    "qualification",
    "proposal",
    "negotiation",
    "closedWon",
    "closedLost",
  ]),
  columnId: z.string().optional().nullable(), // Support flexible column assignment
  forecastCategory: z.enum(["pipeline", "bestCase", "forecast"]).optional().nullable(),
  riskNotes: z.string().max(2000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  ownerId: z.string().min(1),
});

export const opportunityCreateSchema = baseOpportunitySchema.refine(
  (data) => data.account || data.accountId,
  {
    message: "Either account name or accountId must be provided",
    path: ["account"],
  }
);

export const opportunityUpdateSchema = baseOpportunitySchema.partial();

export type OpportunityCreateInput = z.infer<typeof opportunityCreateSchema>;
export type OpportunityUpdateInput = z.infer<typeof opportunityUpdateSchema>;


