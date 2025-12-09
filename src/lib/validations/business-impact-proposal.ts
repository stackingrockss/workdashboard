import { z } from "zod";

/**
 * Validation schema for Business Impact Proposal generation request
 */
export const businessImpactProposalRequestSchema = z.object({
  opportunityId: z.string().min(1, "Opportunity ID is required"),
});

export type BusinessImpactProposalRequest = z.infer<typeof businessImpactProposalRequestSchema>;
