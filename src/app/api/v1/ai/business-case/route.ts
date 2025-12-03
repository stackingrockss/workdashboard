import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateBusinessCase } from "@/lib/ai/generate-business-case";

const businessCaseRequestSchema = z.object({
  opportunityId: z.string().min(1, "Opportunity ID is required"),
});

/**
 * POST /api/v1/ai/business-case
 * Generate a business case for an opportunity using AI
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = businessCaseRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { opportunityId } = parsed.data;

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
      data: { businessCaseGenerationStatus: "generating" },
    });

    // Fetch example business cases (2-3 most recent from org)
    const exampleCases = await prisma.content.findMany({
      where: {
        organizationId: user.organization.id,
        contentType: "business_case",
        body: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { title: true, body: true },
    });

    // Parse consolidated insights from JSON
    const consolidatedPainPoints = Array.isArray(opportunity.consolidatedPainPoints)
      ? (opportunity.consolidatedPainPoints as string[])
      : null;
    const consolidatedGoals = Array.isArray(opportunity.consolidatedGoals)
      ? (opportunity.consolidatedGoals as string[])
      : null;

    // Generate business case
    const result = await generateBusinessCase({
      opportunity: {
        name: opportunity.name,
        amountArr: opportunity.amountArr,
        stage: opportunity.stage,
        confidenceLevel: opportunity.confidenceLevel,
        competition: opportunity.competition,
        platformType: opportunity.platformType,
        consolidatedPainPoints,
        consolidatedGoals,
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
      priorBusinessCases: exampleCases
        .filter((c) => c.body)
        .map((c) => ({
          title: c.title,
          body: c.body!,
        })),
    });

    // Save result
    if (result.success && result.businessCase) {
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: {
          businessCaseContent: result.businessCase,
          businessCaseQuestions: result.questions || null,
          businessCaseGeneratedAt: new Date(),
          businessCaseGenerationStatus: "completed",
        },
      });

      return NextResponse.json({
        success: true,
        businessCase: result.businessCase,
        questions: result.questions,
      });
    } else {
      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { businessCaseGenerationStatus: "failed" },
      });

      return NextResponse.json(
        { success: false, error: result.error || "Failed to generate business case" },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/v1/ai/business-case] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate business case" },
      { status: 500 }
    );
  }
}
