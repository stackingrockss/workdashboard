import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { isTemplateBriefId } from "@/lib/briefs/template-briefs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/briefs/[id]/set-default
 * Sets a brief as the default for its category within the organization.
 * Only one brief can be default per category per organization.
 *
 * Requirements:
 * - User must be authenticated
 * - User must be admin for company-scope briefs
 * - Cannot set template briefs as default (they are globally available)
 * - Brief must exist and belong to user's organization
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Template briefs cannot be set as organization defaults
    if (isTemplateBriefId(id)) {
      return NextResponse.json(
        { error: "Template briefs cannot be set as organization defaults. They are already globally available." },
        { status: 400 }
      );
    }

    // Find the brief
    const brief = await prisma.contentBrief.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!brief) {
      return NextResponse.json(
        { error: "Brief not found" },
        { status: 404 }
      );
    }

    // Check permissions:
    // - Admin can set any brief as default
    // - Non-admin can only set their own personal briefs as default
    if (brief.scope === "company" && !isAdmin(user)) {
      return NextResponse.json(
        { error: "Only admins can set company briefs as default" },
        { status: 403 }
      );
    }

    if (brief.scope === "personal" && brief.createdById !== user.id) {
      return NextResponse.json(
        { error: "You can only set your own briefs as default" },
        { status: 403 }
      );
    }

    // Use a transaction to ensure atomicity
    const updatedBrief = await prisma.$transaction(async (tx) => {
      // Unset any existing default for this category in the organization
      await tx.contentBrief.updateMany({
        where: {
          organizationId: user.organization.id,
          category: brief.category,
          isDefault: true,
          id: { not: id }, // Don't update the brief we're setting as default
        },
        data: { isDefault: false },
      });

      // Set this brief as default
      return await tx.contentBrief.update({
        where: { id },
        data: { isDefault: true },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });
    });

    return NextResponse.json({
      brief: updatedBrief,
      message: `"${updatedBrief.name}" is now the default ${updatedBrief.category.replace(/_/g, " ")} brief`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error setting default brief:", error);
    return NextResponse.json(
      { error: "Failed to set default brief" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/briefs/[id]/set-default
 * Removes the default status from a brief.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Template briefs are not in the database
    if (isTemplateBriefId(id)) {
      return NextResponse.json(
        { error: "Template briefs cannot be modified" },
        { status: 400 }
      );
    }

    // Find the brief
    const brief = await prisma.contentBrief.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!brief) {
      return NextResponse.json(
        { error: "Brief not found" },
        { status: 404 }
      );
    }

    // Check permissions
    if (brief.scope === "company" && !isAdmin(user)) {
      return NextResponse.json(
        { error: "Only admins can modify company brief settings" },
        { status: 403 }
      );
    }

    if (brief.scope === "personal" && brief.createdById !== user.id) {
      return NextResponse.json(
        { error: "You can only modify your own briefs" },
        { status: 403 }
      );
    }

    // Remove default status
    const updatedBrief = await prisma.contentBrief.update({
      where: { id },
      data: { isDefault: false },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      brief: updatedBrief,
      message: `"${updatedBrief.name}" is no longer the default brief`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error removing default brief status:", error);
    return NextResponse.json(
      { error: "Failed to remove default status" },
      { status: 500 }
    );
  }
}
