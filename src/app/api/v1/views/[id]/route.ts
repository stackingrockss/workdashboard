/**
 * API Route: /api/v1/views/[id]
 * Handles single view operations: get, update, delete
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { viewUpdateSchema } from "@/lib/validations/view";
import { SerializedKanbanView, isBuiltInView } from "@/types/view";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/v1/views/[id]
 * Fetch a single view by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Require authentication
    const user = await requireAuth();

    const { id } = params;

    // Check if it's a built-in view
    if (isBuiltInView(id)) {
      return NextResponse.json(
        { error: "Built-in views must be fetched through GET /api/v1/views" },
        { status: 400 }
      );
    }

    const view = await prisma.kanbanView.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!view) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    // Authorization: user can only fetch their own views
    if (view.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Cannot access other users' views" },
        { status: 403 }
      );
    }

    // Transform to serialized format
    const serializedView: SerializedKanbanView = {
      id: view.id,
      name: view.name,
      viewType: view.viewType,
      isActive: view.isActive,
      isDefault: view.isDefault,
      userId: view.userId,
      organizationId: view.organizationId,
      lastAccessedAt: view.lastAccessedAt?.toISOString() || null,
      isShared: view.isShared,
      createdAt: view.createdAt.toISOString(),
      updatedAt: view.updatedAt.toISOString(),
      columns: (view as any).KanbanColumn.map((col: any) => ({
        id: col.id,
        title: col.title,
        order: col.order,
        color: col.color,
        viewId: col.viewId,
        createdAt: col.createdAt.toISOString(),
        updatedAt: col.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json({ view: serializedView }, { status: 200 });
  } catch (error) {
    console.error("Error fetching view:", error);
    return NextResponse.json({ error: "Failed to fetch view" }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/views/[id]
 * Update a view (name, isActive, isDefault)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Require authentication
    const user = await requireAuth();

    const { id } = params;

    // Prevent updating built-in views
    if (isBuiltInView(id)) {
      return NextResponse.json(
        { error: "Built-in views cannot be modified" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = viewUpdateSchema.parse(body);

    // Check if view exists
    const existingView = await prisma.kanbanView.findUnique({
      where: { id },
    });

    if (!existingView) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    // Authorization: user can only update their own views
    if (existingView.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Cannot update other users' views" },
        { status: 403 }
      );
    }

    // If changing name, check for duplicates
    if (validatedData.name && validatedData.name !== existingView.name) {
      const where: any = {};
      if (existingView.userId) where.userId = existingView.userId;
      if (existingView.organizationId) where.organizationId = existingView.organizationId;

      const duplicate = await prisma.kanbanView.findFirst({
        where: {
          ...where,
          name: validatedData.name,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json({ error: "View name already exists" }, { status: 400 });
      }
    }

    // If setting as default, unset other defaults
    if (validatedData.isDefault === true) {
      const where: any = {};
      if (existingView.userId) where.userId = existingView.userId;
      if (existingView.organizationId) where.organizationId = existingView.organizationId;

      await prisma.kanbanView.updateMany({
        where: {
          ...where,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    // If activating, deactivate others
    if (validatedData.isActive === true) {
      const where: any = {};
      if (existingView.userId) where.userId = existingView.userId;
      if (existingView.organizationId) where.organizationId = existingView.organizationId;

      await prisma.kanbanView.updateMany({
        where: {
          ...where,
          id: { not: id },
        },
        data: { isActive: false },
      });
    }

    // Update view
    const view = await prisma.kanbanView.update({
      where: { id },
      data: validatedData,
      include: {
        columns: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Transform to serialized format
    const serializedView: SerializedKanbanView = {
      id: view.id,
      name: view.name,
      viewType: view.viewType,
      isActive: view.isActive,
      isDefault: view.isDefault,
      userId: view.userId,
      organizationId: view.organizationId,
      lastAccessedAt: view.lastAccessedAt?.toISOString() || null,
      isShared: view.isShared,
      createdAt: view.createdAt.toISOString(),
      updatedAt: view.updatedAt.toISOString(),
      columns: (view as any).KanbanColumn.map((col: any) => ({
        id: col.id,
        title: col.title,
        order: col.order,
        color: col.color,
        viewId: col.viewId,
        createdAt: col.createdAt.toISOString(),
        updatedAt: col.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json({ view: serializedView }, { status: 200 });
  } catch (error) {
    console.error("Error updating view:", error);

    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to update view" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/views/[id]
 * Delete a view and all its columns (cascade)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Require authentication
    const user = await requireAuth();

    const { id } = params;

    // Prevent deleting built-in views
    if (isBuiltInView(id)) {
      return NextResponse.json(
        { error: "Built-in views cannot be deleted" },
        { status: 403 }
      );
    }

    // Check if view exists
    const existingView = await prisma.kanbanView.findUnique({
      where: { id },
    });

    if (!existingView) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    // Authorization: user can only delete their own views
    if (existingView.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Cannot delete other users' views" },
        { status: 403 }
      );
    }

    // Prevent deleting the only view
    const where: any = {};
    if (existingView.userId) where.userId = existingView.userId;
    if (existingView.organizationId) where.organizationId = existingView.organizationId;

    const viewCount = await prisma.kanbanView.count({ where });

    if (viewCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only view. Create another view first." },
        { status: 400 }
      );
    }

    // If deleting active or default view, activate/default another one
    if (existingView.isActive || existingView.isDefault) {
      const nextView = await prisma.kanbanView.findFirst({
        where: {
          ...where,
          id: { not: id },
        },
        orderBy: { createdAt: "desc" },
      });

      if (nextView) {
        await prisma.kanbanView.update({
          where: { id: nextView.id },
          data: {
            isActive: existingView.isActive ? true : nextView.isActive,
            isDefault: existingView.isDefault ? true : nextView.isDefault,
          },
        });
      }
    }

    // Delete view (columns cascade automatically)
    await prisma.kanbanView.delete({
      where: { id },
    });

    // Unassign opportunities that were in deleted view's columns
    await prisma.opportunity.updateMany({
      where: {
        columnId: {
          in: await prisma.kanbanColumn
            .findMany({
              where: { viewId: id },
              select: { id: true },
            })
            .then((cols) => cols.map((c) => c.id)),
        },
      },
      data: { columnId: null },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting view:", error);
    return NextResponse.json({ error: "Failed to delete view" }, { status: 500 });
  }
}
