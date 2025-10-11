import { z } from "zod";

export const opportunityCreateSchema = z.object({
  name: z.string().min(2).max(120),
  account: z.string().min(1).max(120),
  amountArr: z.number().int().nonnegative(),
  probability: z.number().int().min(0).max(100),
  nextStep: z.string().max(500).optional().nullable(),
  closeDate: z.string().datetime().optional().nullable(),
  stage: z.enum([
    "prospect",
    "qualification",
    "proposal",
    "negotiation",
    "closedWon",
    "closedLost",
  ]),
  ownerId: z.string().min(1),
});

export const opportunityUpdateSchema = opportunityCreateSchema.partial();

export type OpportunityCreateInput = z.infer<typeof opportunityCreateSchema>;
export type OpportunityUpdateInput = z.infer<typeof opportunityUpdateSchema>;


