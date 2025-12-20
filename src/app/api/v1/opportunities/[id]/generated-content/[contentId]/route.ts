import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { generatedContentUpdateSchema } from "@/lib/validations/framework";

interface RouteParams {
  params: Promise<{ id: string; contentId: string }>;
}

// GET /api/v1/opportunities/[id]/generated-content/[contentId] - Get single content with version history
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, contentId } = await params;

    // Fetch the generated content
    const generatedContent = await prisma.generatedContent.findFirst({
      where: {
        id: contentId,
        opportunityId,
        organizationId: user.organization.id,
      },
      include: {
        framework: {
          select: {
            id: true,
            name: true,
            category: true,
            description: true,
            sections: true,
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

    if (!generatedContent) {
      return NextResponse.json(
        { error: "Generated content not found" },
        { status: 404 }
      );
    }

    // Get version history - find the root and all descendants
    // First, find the root content (the one with no parent)
    let rootId = contentId;
    let currentParentId = generatedContent.parentVersionId;

    // Walk up to find root
    while (currentParentId) {
      const parent = await prisma.generatedContent.findUnique({
        where: { id: currentParentId },
        select: { id: true, parentVersionId: true },
      });
      if (!parent) break;
      rootId = parent.id;
      currentParentId = parent.parentVersionId;
    }

    // Now get all versions from the root down
    const allVersions = await prisma.generatedContent.findMany({
      where: {
        opportunityId,
        frameworkId: generatedContent.frameworkId,
        organizationId: user.organization.id,
      },
      select: {
        id: true,
        version: true,
        createdAt: true,
        generatedAt: true,
        generationStatus: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({
      generatedContent,
      versions: allVersions,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching generated content:", error);
    return NextResponse.json(
      { error: "Failed to fetch generated content" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/opportunities/[id]/generated-content/[contentId] - Update content (manual edits)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, contentId } = await params;

    // Verify content exists and user has access
    const existing = await prisma.generatedContent.findFirst({
      where: {
        id: contentId,
        opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Generated content not found" },
        { status: 404 }
      );
    }

    const json = await req.json();
    const parsed = generatedContentUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const updated = await prisma.generatedContent.update({
      where: { id: contentId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.content && { content: data.content }),
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

    return NextResponse.json({ generatedContent: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating generated content:", error);
    return NextResponse.json(
      { error: "Failed to update generated content" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/opportunities/[id]/generated-content/[contentId] - Delete content
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, contentId } = await params;

    // Verify content exists and user has access
    const existing = await prisma.generatedContent.findFirst({
      where: {
        id: contentId,
        opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Generated content not found" },
        { status: 404 }
      );
    }

    // Delete the content (will cascade to child versions)
    await prisma.generatedContent.delete({
      where: { id: contentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting generated content:", error);
    return NextResponse.json(
      { error: "Failed to delete generated content" },
      { status: 500 }
    );
  }
}
