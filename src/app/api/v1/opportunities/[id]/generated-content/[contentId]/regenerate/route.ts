import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { contextSelectionSchema } from "@/lib/validations/framework";
import { inngest } from "@/lib/inngest/client";

interface RouteParams {
  params: Promise<{ id: string; contentId: string }>;
}

// POST /api/v1/opportunities/[id]/generated-content/[contentId]/regenerate - Create new version
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, contentId } = await params;

    // Fetch the existing content
    const existingContent = await prisma.generatedContent.findFirst({
      where: {
        id: contentId,
        opportunityId,
        organizationId: user.organization.id,
      },
      include: {
        framework: true,
      },
    });

    if (!existingContent) {
      return NextResponse.json(
        { error: "Generated content not found" },
        { status: 404 }
      );
    }

    // Parse new context selection (or use previous)
    const json = await req.json().catch(() => ({}));
    const parsed = contextSelectionSchema.safeParse(
      json.contextSelection || existingContent.contextSnapshot || {}
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const contextSelection = parsed.data;

    // Get the highest version number for this framework+opportunity
    const maxVersion = await prisma.generatedContent.findFirst({
      where: {
        opportunityId,
        frameworkId: existingContent.frameworkId,
        organizationId: user.organization.id,
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const newVersion = (maxVersion?.version || 0) + 1;

    // Create a new version linked to the previous one
    const newContent = await prisma.generatedContent.create({
      data: {
        frameworkId: existingContent.frameworkId,
        opportunityId: existingContent.opportunityId,
        title: existingContent.title,
        content: "", // Will be filled by background job
        contextSnapshot: contextSelection,
        version: newVersion,
        parentVersionId: existingContent.id,
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
        generatedContentId: newContent.id,
        opportunityId,
        frameworkId: existingContent.frameworkId,
        contextSelection,
        userId: user.id,
        organizationId: user.organization.id,
      },
    });

    return NextResponse.json(
      { generatedContent: newContent },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error regenerating content:", error);
    return NextResponse.json(
      { error: "Failed to regenerate content" },
      { status: 500 }
    );
  }
}
