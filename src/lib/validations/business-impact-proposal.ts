import { z } from "zod";

/**
 * Validation schema for Business Impact Proposal generation request
 */
export const businessImpactProposalRequestSchema = z.object({
  opportunityId: z.string().min(1, "Opportunity ID is required"),
  additionalContext: z
    .string()
    .max(5000, "Additional context must be under 5000 characters")
    .optional(),
});

export type BusinessImpactProposalRequest = z.infer<typeof businessImpactProposalRequestSchema>;
