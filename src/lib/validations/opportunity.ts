import { z } from "zod";

const baseOpportunitySchema = z.object({
  name: z.string().min(2).max(120),
  // Support both old account field and new accountId for backward compatibility
  account: z.string().min(1).max(120).optional(),
  accountId: z.string().optional(),
  amountArr: z.number().int().nonnegative().optional().default(0),
  probability: z.number().int().min(0).max(100).optional(),
  nextStep: z.string().max(500).optional().nullable().transform(val => val === "" ? null : val),
  quarter: z.string().max(20).optional().nullable().transform(val => val === "" ? null : val),
  stage: z.enum([
    "discovery",
    "demo",
    "validateSolution",
    "decisionMakerApproval",
    "contracting",
    "closedWon",
    "closedLost",
  ]).optional(),
  columnId: z.string().optional().nullable(), // Support flexible column assignment
  forecastCategory: z.enum(["pipeline", "bestCase", "forecast"]).optional().nullable().default("pipeline"),
  riskNotes: z.string().max(2000).optional().nullable().transform(val => val === "" ? null : val),
  notes: z.string().max(5000).optional().nullable().transform(val => val === "" ? null : val),
  accountResearch: z.string().max(50000).optional().nullable().transform(val => val === "" ? null : val),
  ownerId: z.string().optional(),
});

export const opportunityCreateSchema = baseOpportunitySchema
  .extend({
    // Close date is required for creation
    closeDate: z.string().datetime().min(1, "Close date is required"),
  })
  .refine(
    (data) => data.account || data.accountId,
    {
      message: "Either account name or accountId must be provided",
      path: ["account"],
    }
  );

export const opportunityUpdateSchema = baseOpportunitySchema
  .extend({
    // Close date is optional for updates
    closeDate: z.string().datetime().optional().nullable().transform(val => val === "" ? null : val),
  })
  .partial();

export type OpportunityCreateInput = z.infer<typeof opportunityCreateSchema>;
export type OpportunityUpdateInput = z.infer<typeof opportunityUpdateSchema>;


