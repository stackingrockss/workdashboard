import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { briefUpdateSchema } from "@/lib/validations/brief";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/briefs/[id] - Get a single brief
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const brief = await prisma.contentBrief.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
        // User can see company briefs or their own personal briefs
        OR: [
          { scope: "company" },
          { scope: "personal", createdById: user.id },
        ],
      },
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

    if (!brief) {
      return NextResponse.json(
        { error: "Brief not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ brief });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching brief:", error);
    return NextResponse.json(
      { error: "Failed to fetch brief" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/briefs/[id] - Update a brief
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // First, find the brief to check permissions
    const existing = await prisma.contentBrief.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Brief not found" },
        { status: 404 }
      );
    }

    // Check permissions: only creator or admin can edit
    const canEdit =
      existing.createdById === user.id ||
      (existing.scope === "company" && isAdmin(user));

    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to edit this brief" },
        { status: 403 }
      );
    }

    // Cannot edit default briefs unless admin
    if (existing.isDefault && !isAdmin(user)) {
      return NextResponse.json(
        { error: "Default briefs cannot be edited" },
        { status: 403 }
      );
    }

    const json = await req.json();
    const parsed = briefUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Cannot change scope from company to personal or vice versa
    if (data.scope && data.scope !== existing.scope) {
      return NextResponse.json(
        { error: "Cannot change brief scope after creation" },
        { status: 400 }
      );
    }

    // Check for duplicate name if name is being changed
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.contentBrief.findFirst({
        where: {
          organizationId: user.organization.id,
          name: data.name,
          scope: existing.scope,
          id: { not: id },
          ...(existing.scope === "personal"
            ? { createdById: user.id }
            : {}),
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: `A ${existing.scope} brief with this name already exists` },
          { status: 409 }
        );
      }
    }

    const brief = await prisma.contentBrief.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category && { category: data.category }),
        ...(data.systemInstruction && { systemInstruction: data.systemInstruction }),
        ...(data.outputFormat !== undefined && { outputFormat: data.outputFormat }),
        ...(data.sections && { sections: data.sections }),
        ...(data.contextConfig !== undefined && { contextConfig: data.contextConfig }),
      },
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

    return NextResponse.json({ brief });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating brief:", error);
    return NextResponse.json(
      { error: "Failed to update brief" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/briefs/[id] - Delete a brief
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // First, find the brief to check permissions
    const existing = await prisma.contentBrief.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Brief not found" },
        { status: 404 }
      );
    }

    // Check permissions: only creator or admin can delete
    const canDelete =
      existing.createdById === user.id ||
      (existing.scope === "company" && isAdmin(user));

    if (!canDelete) {
      return NextResponse.json(
        { error: "You don't have permission to delete this brief" },
        { status: 403 }
      );
    }

    // Cannot delete default briefs
    if (existing.isDefault) {
      return NextResponse.json(
        { error: "Default briefs cannot be deleted" },
        { status: 403 }
      );
    }

    // Delete the brief (cascades to GeneratedContent)
    await prisma.contentBrief.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting brief:", error);
    return NextResponse.json(
      { error: "Failed to delete brief" },
      { status: 500 }
    );
  }
}
