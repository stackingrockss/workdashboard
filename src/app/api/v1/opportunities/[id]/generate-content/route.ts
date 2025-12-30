import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { generateContentSchema } from "@/lib/validations/brief";
import { inngest } from "@/lib/inngest/client";
import { getTemplateBriefById, isTemplateBriefId } from "@/lib/briefs/template-briefs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/v1/opportunities/[id]/generate-content - Start content generation
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId } = await params;

    // Verify opportunity exists and user has access
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    const json = await req.json();
    const parsed = generateContentSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { briefId, contextSelection } = parsed.data;

    // Check if using a template brief or database brief
    const isTemplate = isTemplateBriefId(briefId);
    let brief;
    let dbBriefId: string | null = null;

    if (isTemplate) {
      // Get template brief from code
      const templateBrief = getTemplateBriefById(briefId);
      if (!templateBrief) {
        return NextResponse.json(
          { error: "Brief not found" },
          { status: 404 }
        );
      }
      brief = templateBrief;
    } else {
      // Verify database brief exists and user has access
      const dbBrief = await prisma.contentBrief.findFirst({
        where: {
          id: briefId,
          organizationId: user.organization.id,
          OR: [
            { scope: "company" },
            { scope: "personal", createdById: user.id },
          ],
        },
      });

      if (!dbBrief) {
        return NextResponse.json(
          { error: "Brief not found" },
          { status: 404 }
        );
      }
      brief = dbBrief;
      dbBriefId = dbBrief.id;
    }

    // Create a pending Document record (unified document system)
    // Category is set from the brief's category
    // For template briefs, briefId is null but we store templateBriefId in contextSnapshot
    const document = await prisma.document.create({
      data: {
        opportunityId: opportunity.id,
        organizationId: user.organization.id,
        title: `${brief.name} - ${opportunity.name}`,
        category: brief.category,
        content: "", // Will be filled by the background job
        briefId: dbBriefId, // null for template briefs
        generationStatus: "pending",
        contextSnapshot: {
          ...contextSelection,
          ...(isTemplate ? { templateBriefId: briefId } : {}),
        } as Prisma.InputJsonValue,
        version: 1,
        createdById: user.id,
      },
      include: {
        brief: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Trigger background job for generation
    await inngest.send({
      name: "document/generate-content",
      data: {
        documentId: document.id,
        opportunityId: opportunity.id,
        briefId: dbBriefId,
        templateBriefId: isTemplate ? briefId : null,
        contextSelection: contextSelection || {},
        userId: user.id,
        organizationId: user.organization.id,
      },
    });

    // Return document with legacy field name for backwards compatibility
    return NextResponse.json(
      { document, generatedContent: document },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error starting content generation:", error);
    return NextResponse.json(
      { error: "Failed to start content generation" },
      { status: 500 }
    );
  }
}
