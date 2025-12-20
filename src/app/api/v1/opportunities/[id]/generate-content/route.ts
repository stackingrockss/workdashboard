import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { generateContentSchema } from "@/lib/validations/framework";
import { inngest } from "@/lib/inngest/client";

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

    const { frameworkId, contextSelection } = parsed.data;

    // Verify framework exists and user has access
    const framework = await prisma.contentFramework.findFirst({
      where: {
        id: frameworkId,
        organizationId: user.organization.id,
        OR: [
          { scope: "company" },
          { scope: "personal", createdById: user.id },
        ],
      },
    });

    if (!framework) {
      return NextResponse.json(
        { error: "Framework not found" },
        { status: 404 }
      );
    }

    // Create a pending GeneratedContent record
    const generatedContent = await prisma.generatedContent.create({
      data: {
        frameworkId: framework.id,
        opportunityId: opportunity.id,
        title: `${framework.name} - ${opportunity.name}`,
        content: "", // Will be filled by the background job
        contextSnapshot: contextSelection,
        version: 1,
        generationStatus: "pending",
        createdById: user.id,
        organizationId: user.organization.id,
      },
      include: {
        framework: {
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
      name: "framework/generate",
      data: {
        generatedContentId: generatedContent.id,
        opportunityId: opportunity.id,
        frameworkId: framework.id,
        contextSelection,
        userId: user.id,
        organizationId: user.organization.id,
      },
    });

    return NextResponse.json(
      { generatedContent },
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
