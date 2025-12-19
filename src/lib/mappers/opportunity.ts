import { Opportunity } from "@/types/opportunity";
import { Prisma } from "@prisma/client";

/**
 * Type for Opportunity with all relations that might be included in queries
 */
type PrismaOpportunityWithRelations = Prisma.OpportunityGetPayload<{
  include: {
    owner: true;
    account: true;
    gongCalls: true;
    granolaNotes: true;
    googleNotes: true;
    contacts: true;
  };
}>;

/**
 * Maps a Prisma Opportunity result to the Opportunity type used in the frontend.
 * Converts null values to undefined and DateTime objects to ISO strings.
 *
 * @param opp - Prisma opportunity result (can include relations)
 * @returns Opportunity object with properly typed fields
 */
export function mapPrismaOpportunityToOpportunity(
  opp: Partial<PrismaOpportunityWithRelations> & {
    id: string;
    name: string;
    amountArr: number;
    confidenceLevel: number;
    stage: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  }
): Opportunity {
  return {
    id: opp.id,
    name: opp.name,
    accountId: opp.accountId || undefined,
    accountName: opp.accountName || undefined,
    account: opp.account
      ? {
          id: opp.account.id,
          name: opp.account.name,
          website: opp.account.website || undefined,
        }
      : undefined,
    amountArr: opp.amountArr,
    confidenceLevel: opp.confidenceLevel,
    nextStep: opp.nextStep || undefined,
    cbc: opp.cbc
      ? opp.cbc.toISOString().split('T')[0] // Extract date-only part (YYYY-MM-DD)
      : undefined,
    nextCallDate: opp.nextCallDate?.toISOString() || null,
    nextCallDateSource: opp.nextCallDateSource || null,
    nextCallDateManuallySet: opp.nextCallDateManuallySet || false,
    nextCallDateLastCalculated: opp.nextCallDateLastCalculated?.toISOString() || null,
    nextCallDateEventId: opp.nextCallDateEventId || null,
    closeDate: opp.closeDate
      ? opp.closeDate.toISOString().split('T')[0] // Extract date-only part (YYYY-MM-DD)
      : undefined,
    quarter: opp.quarter || undefined,
    stage: opp.stage as Opportunity["stage"],
    columnId: opp.columnId || undefined,
    forecastCategory: (opp.forecastCategory as Opportunity["forecastCategory"]) || undefined,
    riskNotes: opp.riskNotes || undefined,
    notes: opp.notes || undefined,
    accountResearch: opp.accountResearch || undefined,
    accountResearchStatus: (opp.accountResearchStatus as Opportunity["accountResearchStatus"]) || undefined,
    decisionMakers: opp.decisionMakers || undefined,
    competition: opp.competition || undefined,
    legalReviewStatus: (opp.legalReviewStatus as Opportunity["legalReviewStatus"]) || undefined,
    securityReviewStatus: (opp.securityReviewStatus as Opportunity["securityReviewStatus"]) || undefined,
    platformType: (opp.platformType as Opportunity["platformType"]) || undefined,
    businessCaseStatus: (opp.businessCaseStatus as Opportunity["businessCaseStatus"]) || undefined,
    // Business case generation fields
    businessCaseContent: opp.businessCaseContent || undefined,
    businessCaseQuestions: opp.businessCaseQuestions || undefined,
    businessCaseGeneratedAt: opp.businessCaseGeneratedAt?.toISOString() || undefined,
    businessCaseGenerationStatus: (opp.businessCaseGenerationStatus as Opportunity["businessCaseGenerationStatus"]) || undefined,
    owner: opp.owner
      ? {
          id: opp.owner.id,
          name: opp.owner.name || opp.owner.email || "Unknown",
          email: opp.owner.email || undefined,
        }
      : {
          // Fallback for cases where owner is not included but ownerId exists
          id: opp.ownerId,
          name: "Unknown",
          email: undefined,
        },
    gongCalls: opp.gongCalls?.map((call) => ({
      id: call.id,
      opportunityId: call.opportunityId,
      organizationId: call.organizationId,
      title: call.title,
      url: call.url,
      meetingDate: call.meetingDate.toISOString(),
      noteType: call.noteType as "customer" | "internal" | "prospect",
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString(),
    })),
    granolaNotes: opp.granolaNotes?.map((note) => ({
      id: note.id,
      opportunityId: note.opportunityId,
      title: note.title,
      url: note.url,
      meetingDate: note.meetingDate.toISOString(),
      noteType: note.noteType as "customer" | "internal" | "prospect",
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    googleNotes: opp.googleNotes?.map((note) => ({
      id: note.id,
      opportunityId: note.opportunityId,
      title: note.title,
      url: note.url,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    createdAt: opp.createdAt.toISOString(),
    updatedAt: opp.updatedAt.toISOString(),
  };
}

/**
 * Maps an array of Prisma Opportunity results to Opportunity[] type
 */
export function mapPrismaOpportunitiesToOpportunities(
  opportunities: Parameters<typeof mapPrismaOpportunityToOpportunity>[0][]
): Opportunity[] {
  return opportunities.map(mapPrismaOpportunityToOpportunity);
}
