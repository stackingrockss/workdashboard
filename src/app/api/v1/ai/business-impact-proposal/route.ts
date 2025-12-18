import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { businessImpactProposalRequestSchema } from "@/lib/validations/business-impact-proposal";
import { generateBusinessImpactProposal } from "@/lib/ai/generate-business-impact-proposal";

/**
 * POST /api/v1/ai/business-impact-proposal
 * Generate a Business Impact Proposal for an opportunity using AI
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = businessImpactProposalRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { opportunityId, additionalContext } = parsed.data;

    // Fetch opportunity with contacts and account (verify org access)
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
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
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Set status to generating
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { businessProposalGenerationStatus: "generating" },
    });

    // Try to find a Business Impact Proposal template in Content library
    // Look for templates with "proposal" in the title
    const template = await prisma.content.findFirst({
      where: {
        organizationId: user.organization.id,
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

    // Parse consolidated insights from JSON
    const consolidatedPainPoints = Array.isArray(opportunity.consolidatedPainPoints)
      ? (opportunity.consolidatedPainPoints as string[])
      : null;
    const consolidatedGoals = Array.isArray(opportunity.consolidatedGoals)
      ? (opportunity.consolidatedGoals as string[])
      : null;
    const consolidatedWhyAndWhyNow = Array.isArray(opportunity.consolidatedWhyAndWhyNow)
      ? (opportunity.consolidatedWhyAndWhyNow as string[])
      : null;
    const consolidatedMetrics = Array.isArray(opportunity.consolidatedMetrics)
      ? (opportunity.consolidatedMetrics as string[])
      : null;
    const consolidatedRiskAssessment = opportunity.consolidatedRiskAssessment
      ? (opportunity.consolidatedRiskAssessment as { overall?: string; reasons?: string[] })
      : null;

    // Generate Business Impact Proposal
    const result = await generateBusinessImpactProposal({
      opportunity: {
        name: opportunity.name,
        amountArr: opportunity.amountArr,
        stage: opportunity.stage,
        confidenceLevel: opportunity.confidenceLevel,
        closeDate: opportunity.closeDate?.toISOString().split("T")[0] || null,
        competition: opportunity.competition,
        platformType: opportunity.platformType,
        consolidatedPainPoints,
        consolidatedGoals,
        consolidatedWhyAndWhyNow,
        consolidatedMetrics,
        consolidatedRiskAssessment,
        accountResearch: opportunity.accountResearch,
      },
      account: opportunity.account,
      contacts: opportunity.contacts.map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        title: c.title,
        role: c.role,
        sentiment: c.sentiment,
      })),
      template: template
        ? {
            title: template.title,
            body: template.body!,
          }
        : null,
      additionalContext: additionalContext || null,
    });

    // Save result
    if (result.success && result.proposal) {
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: {
          businessProposalContent: result.proposal,
          businessProposalGeneratedAt: new Date(),
          businessProposalGenerationStatus: "completed",
        },
      });

      return NextResponse.json({
        success: true,
        proposal: result.proposal,
        templateUsed: template?.title || null,
      });
    } else {
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { businessProposalGenerationStatus: "failed" },
      });

      return NextResponse.json(
        { success: false, error: result.error || "Failed to generate Business Impact Proposal" },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/v1/ai/business-impact-proposal] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate Business Impact Proposal" },
      { status: 500 }
    );
  }
}
