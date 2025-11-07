/**
 * API Route: /api/v1/views/[id]/duplicate
 * Creates a copy of a view with optional new name
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { viewDuplicateSchema } from "@/lib/validations/view";
import { SerializedKanbanView, MAX_VIEWS_PER_USER, isBuiltInView, getViewTypeFromBuiltInId } from "@/types/view";
import { getBuiltInColumns } from "@/lib/utils/built-in-views";

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/v1/views/[id]/duplicate
 * Duplicate a view (creates a custom copy with columns)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Require authentication
    const user = await requireAuth();

    const { id } = params;
    const body = await request.json();
    const validatedData = viewDuplicateSchema.parse(body);

    let sourceView: any;
    let sourceColumns: any[] = [];
    let userId: string | null = null;
    let organizationId: string | null = null;

    // Handle built-in views
    if (isBuiltInView(id)) {
      const viewType = getViewTypeFromBuiltInId(id);
      if (!viewType) {
        return NextResponse.json({ error: "Invalid built-in view ID" }, { status: 400 });
      }

      // For built-in views, use authenticated user's ID
      const { userId: requestUserId, organizationId: requestOrgId } = body;

      // Authorization: ensure userId from request matches authenticated user
      if (requestUserId && requestUserId !== user.id) {
        return NextResponse.json(
          { error: "Unauthorized: Cannot duplicate view for other users" },
          { status: 403 }
        );
      }

      userId = requestUserId || user.id;
      organizationId = requestOrgId || null;

      // Get fiscal year start month
      let fiscalYearStartMonth = 1;
      if (userId) {
        const settings = await prisma.companySettings.findUnique({
          where: { userId },
          select: { fiscalYearStartMonth: true },
        });
        fiscalYearStartMonth = settings?.fiscalYearStartMonth || 1;
      } else if (organizationId) {
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { fiscalYearStartMonth: true },
        });
        fiscalYearStartMonth = org?.fiscalYearStartMonth || 1;
      }

      // Generate built-in columns
      sourceColumns = getBuiltInColumns(viewType, fiscalYearStartMonth);
    } else {
      // Fetch existing custom view
      sourceView = await prisma.kanbanView.findUnique({
        where: { id },
        include: {
          columns: {
            orderBy: { order: "asc" },
          },
        },
      });

      if (!sourceView) {
        return NextResponse.json({ error: "View not found" }, { status: 404 });
      }

      // Authorization: user can only duplicate their own views
      if (sourceView.userId !== user.id) {
        return NextResponse.json(
          { error: "Unauthorized: Cannot duplicate other users' views" },
          { status: 403 }
        );
      }

      userId = sourceView.userId;
      organizationId = sourceView.organizationId;
      sourceColumns = (sourceView as any).columns;
    }

    // Check view count limit
    const where: any = {};
    if (userId) where.userId = userId;
    if (organizationId) where.organizationId = organizationId;

    const existingViewCount = await prisma.kanbanView.count({ where });

    if (existingViewCount >= MAX_VIEWS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_VIEWS_PER_USER} views per user/organization` },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const nameExists = await prisma.kanbanView.findFirst({
      where: {
        ...where,
        name: validatedData.newName,
      },
    });

    if (nameExists) {
      return NextResponse.json({ error: "View name already exists" }, { status: 400 });
    }

    // Create new view
    const newView = await prisma.kanbanView.create({
      data: {
        name: validatedData.newName,
        viewType: "custom", // Duplicated views are always custom
        userId,
        organizationId,
        isDefault: false,
        isActive: true, // Newly duplicated view is activated
      },
    });

    // Deactivate other views
    await prisma.kanbanView.updateMany({
      where: {
        ...where,
        id: { not: newView.id },
      },
      data: { isActive: false },
    });

    // Copy columns if requested
    if (validatedData.includeColumns && sourceColumns.length > 0) {
      await prisma.kanbanColumn.createMany({
        data: sourceColumns.map((col: any, index: number) => ({
          title: col.title,
          order: index,
          color: col.color || null,
          viewId: newView.id,
        })),
      });
    }

    // Fetch created view with columns
    const createdView = await prisma.kanbanView.findUnique({
      where: { id: newView.id },
      include: {
        columns: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!createdView) {
      return NextResponse.json({ error: "Failed to fetch created view" }, { status: 500 });
    }

    // Transform to serialized format
    const serializedView: SerializedKanbanView = {
      id: createdView.id,
      name: createdView.name,
      viewType: createdView.viewType,
      isActive: createdView.isActive,
      isDefault: createdView.isDefault,
      userId: createdView.userId,
      organizationId: createdView.organizationId,
      lastAccessedAt: createdView.lastAccessedAt?.toISOString() || null,
      isShared: createdView.isShared,
      createdAt: createdView.createdAt.toISOString(),
      updatedAt: createdView.updatedAt.toISOString(),
      columns: (createdView as any).KanbanColumn.map((col: any) => ({
        id: col.id,
        title: col.title,
        order: col.order,
        color: col.color,
        viewId: col.viewId,
        createdAt: col.createdAt.toISOString(),
        updatedAt: col.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json({ view: serializedView }, { status: 201 });
  } catch (error) {
    console.error("Error duplicating view:", error);

    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to duplicate view" }, { status: 500 });
  }
}
