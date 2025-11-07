/**
 * API Route: /api/v1/views/[id]/activate
 * Sets a view as active and updates lastAccessedAt
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { SerializedKanbanView, isBuiltInView, PrismaViewWithColumns, PrismaWhereClause } from "@/types/view";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/views/[id]/activate
 * Activate a view (sets isActive=true, updates lastAccessedAt, deactivates others)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Require authentication
    const user = await requireAuth();

    const { id } = await params;

    // Built-in views can be "activated" (tracked in localStorage on client)
    // but we don't store them in database, so just return success
    if (isBuiltInView(id)) {
      return NextResponse.json(
        {
          view: {
            id,
            isActive: true,
            lastAccessedAt: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    }

    // Check if view exists
    const existingView = await prisma.kanbanView.findUnique({
      where: { id },
    });

    if (!existingView) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    // Authorization: user can only activate their own views
    if (existingView.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Cannot activate other users' views" },
        { status: 403 }
      );
    }

    // Deactivate all other views for this user/org
    const where: PrismaWhereClause = {};
    if (existingView.userId) where.userId = existingView.userId;
    if (existingView.organizationId) where.organizationId = existingView.organizationId;

    await prisma.kanbanView.updateMany({
      where: {
        ...where,
        id: { not: id },
      },
      data: { isActive: false },
    });

    // Activate this view and update lastAccessedAt
    const view = await prisma.kanbanView.update({
      where: { id },
      data: {
        isActive: true,
        lastAccessedAt: new Date(),
      },
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
      columns: (view as PrismaViewWithColumns).columns.map((col) => ({
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
    console.error("Error activating view:", error);
    return NextResponse.json({ error: "Failed to activate view" }, { status: 500 });
  }
}
