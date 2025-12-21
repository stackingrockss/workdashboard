// src/lib/inngest/functions/generate-bip-document.ts
// Inngest background job for generating Business Impact Proposals as Documents

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import {
  generateBusinessImpactProposal,
  BusinessImpactProposalContext,
} from "@/lib/ai/generate-business-impact-proposal";

interface BIPGenerateEventData {
  documentId: string;
  opportunityId: string;
  additionalContext: string | null;
  userId: string;
  organizationId: string;
}

/**
 * Background job that generates a Business Impact Proposal and saves it as a Document
 * Triggered when user clicks "Generate New BIP" button in the BIP tab
 */
export const generateBIPDocumentJob = inngest.createFunction(
  {
    id: "generate-bip-document",
    name: "Generate BIP Document",
    retries: 3,
  },
  { event: "document/generate-bip" },
  async ({ event, step }) => {
    const { documentId, opportunityId, additionalContext, organizationId } =
      event.data as BIPGenerateEventData;

    // Step 1: Set status to generating
    await step.run("set-generating-status", async () => {
      return await prisma.document.update({
        where: { id: documentId },
        data: { generationStatus: "generating" },
      });
    });

    // Step 2: Fetch opportunity with all context
    const opportunityContext = await step.run(
      "fetch-opportunity-context",
      async () => {
        const opportunity = await prisma.opportunity.findFirst({
          where: {
            id: opportunityId,
            organizationId,
          },
          include: {
            account: {
              select: {
                name: true,
                industry: true,
                website: true,
                ticker: true,
              },
            },
            contacts: {
              select: {
                firstName: true,
                lastName: true,
                title: true,
                role: true,
                sentiment: true,
              },
            },
          },
        });

        if (!opportunity) {
          throw new Error(`Opportunity not found: ${opportunityId}`);
        }

        return opportunity;
      }
    );

    // Step 3: Look for template in Content library
    const template = await step.run("fetch-template", async () => {
      const t = await prisma.content.findFirst({
        where: {
          organizationId,
          contentType: "business_case",
          OR: [
            { title: { contains: "proposal", mode: "insensitive" } },
            { title: { contains: "impact", mode: "insensitive" } },
            { title: { contains: "BIP", mode: "insensitive" } },
          ],
          body: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: { title: true, body: true },
      });

      return t;
    });

    // Step 4: Build context for AI generation
    // Note: We build this inline since step.run serializes data through JSON
    // which loses type information. We cast opportunityContext appropriately.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opp = opportunityContext as any;

    // Parse consolidated insights from JSON fields
    const consolidatedPainPoints = Array.isArray(opp.consolidatedPainPoints)
      ? (opp.consolidatedPainPoints as string[])
      : null;
    const consolidatedGoals = Array.isArray(opp.consolidatedGoals)
      ? (opp.consolidatedGoals as string[])
      : null;
    const consolidatedWhyAndWhyNow = Array.isArray(opp.consolidatedWhyAndWhyNow)
      ? (opp.consolidatedWhyAndWhyNow as string[])
      : null;
    const consolidatedMetrics = Array.isArray(opp.consolidatedMetrics)
      ? (opp.consolidatedMetrics as string[])
      : null;
    const consolidatedRiskAssessment = opp.consolidatedRiskAssessment
      ? (opp.consolidatedRiskAssessment as {
          overall?: string;
          reasons?: string[];
        })
      : null;

    // Format close date - handle both Date object and string (from JSON serialization)
    let closeDateStr: string | null = null;
    if (opp.closeDate) {
      if (opp.closeDate instanceof Date) {
        closeDateStr = opp.closeDate.toISOString().split("T")[0];
      } else if (typeof opp.closeDate === "string") {
        closeDateStr = opp.closeDate.split("T")[0];
      }
    }

    const context: BusinessImpactProposalContext = {
      opportunity: {
        name: opp.name,
        amountArr: opp.amountArr,
        stage: opp.stage,
        confidenceLevel: opp.confidenceLevel,
        closeDate: closeDateStr,
        competition: opp.competition,
        platformType: opp.platformType,
        consolidatedPainPoints,
        consolidatedGoals,
        consolidatedWhyAndWhyNow,
        consolidatedMetrics,
        consolidatedRiskAssessment,
        accountResearch: opp.accountResearch,
      },
      account: opp.account,
      contacts: (opp.contacts as Array<{ firstName: string; lastName: string; title: string | null; role: string; sentiment: string }>).map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        title: c.title,
        role: c.role,
        sentiment: c.sentiment,
      })),
      template: template ? { title: template.title, body: template.body! } : null,
      additionalContext,
    };

    // Step 5: Generate BIP using AI
    const result = await step.run("generate-bip-ai", async () => {
      return await generateBusinessImpactProposal(context);
    });

    // Step 6: Handle result
    if (!result.success || !result.proposal) {
      await step.run("set-failed-status", async () => {
        return await prisma.document.update({
          where: { id: documentId },
          data: {
            generationStatus: "failed",
            generationError: result.error || "Unknown error during generation",
          },
        });
      });

      throw new Error(`BIP generation failed: ${result.error}`);
    }

    // Step 7: Save generated content
    const updatedDocument = await step.run(
      "save-generated-content",
      async () => {
        return await prisma.document.update({
          where: { id: documentId },
          data: {
            content: result.proposal!,
            generationStatus: "completed",
            generatedAt: new Date(),
            generationError: null,
          },
          select: {
            id: true,
            title: true,
            version: true,
            generationStatus: true,
            generatedAt: true,
          },
        });
      }
    );

    return {
      success: true,
      documentId: updatedDocument.id,
      opportunityId,
      title: updatedDocument.title,
      generatedAt: updatedDocument.generatedAt,
      templateUsed: template?.title || null,
    };
  }
);
