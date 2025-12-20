import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { restoreVersionSchema } from "@/lib/validations/framework";

interface RouteParams {
  params: Promise<{ id: string; contentId: string }>;
}

// POST /api/v1/opportunities/[id]/generated-content/[contentId]/restore - Restore a previous version
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id: opportunityId, contentId } = await params;

    // Verify current content exists
    const currentContent = await prisma.generatedContent.findFirst({
      where: {
        id: contentId,
        opportunityId,
        organizationId: user.organization.id,
      },
    });

    if (!currentContent) {
      return NextResponse.json(
        { error: "Generated content not found" },
        { status: 404 }
      );
    }

    const json = await req.json();
    const parsed = restoreVersionSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { versionId } = parsed.data;

    // Fetch the version to restore
    const versionToRestore = await prisma.generatedContent.findFirst({
      where: {
        id: versionId,
        opportunityId,
        frameworkId: currentContent.frameworkId,
        organizationId: user.organization.id,
        generationStatus: "completed", // Can only restore completed versions
      },
    });

    if (!versionToRestore) {
      return NextResponse.json(
        { error: "Version not found or not eligible for restoration" },
        { status: 404 }
      );
    }

    // Get the highest version number
    const maxVersion = await prisma.generatedContent.findFirst({
      where: {
        opportunityId,
        frameworkId: currentContent.frameworkId,
        organizationId: user.organization.id,
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const newVersion = (maxVersion?.version || 0) + 1;

    // Create a new version with the restored content
    const restoredContent = await prisma.generatedContent.create({
      data: {
        frameworkId: versionToRestore.frameworkId,
        opportunityId: versionToRestore.opportunityId,
        title: versionToRestore.title,
        content: versionToRestore.content,
        contextSnapshot: versionToRestore.contextSnapshot ?? undefined,
        version: newVersion,
        parentVersionId: contentId, // Link to current version
        generationStatus: "completed", // Already complete since we're restoring
        generatedAt: new Date(),
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

    return NextResponse.json(
      { generatedContent: restoredContent },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error restoring version:", error);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  }
}
