/**
 * API Route: /api/v1/views
 * Handles listing and creating Kanban views
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { viewCreateSchema, viewQuerySchema } from "@/lib/validations/view";
import { SerializedKanbanView, MAX_VIEWS_PER_USER, PrismaViewWithColumns, PrismaWhereClause } from "@/types/view";
import { getAllBuiltInViews } from "@/lib/utils/built-in-views";
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from "@/lib/utils/pagination";
import { paginationQuerySchema } from "@/lib/validations/pagination";
import { cachedResponse } from "@/lib/cache";
import { Prisma } from "@prisma/client";

/**
 * GET /api/v1/views
 * Fetch all views (custom + built-in) for a user or organization
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const params = viewQuerySchema.parse({
      userId: searchParams.get("userId"),
      organizationId: searchParams.get("organizationId"),
      includeColumns: searchParams.get("includeColumns"),
      activeOnly: searchParams.get("activeOnly"),
    });

    // Default to authenticated user's ID
    const userId = params.userId || user.id;

    // Authorization: user can only fetch their own views
    if (userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Cannot fetch other users' views" },
        { status: 403 }
      );
    }

    // Build where clause
    const where: PrismaWhereClause = {};
    if (params.userId) where.userId = params.userId;
    if (params.organizationId) where.organizationId = params.organizationId;
    if (params.activeOnly) where.isActive = true;

    // Define include for relations
    const includeRelations = params.includeColumns
      ? {
          columns: {
            orderBy: { order: "asc" as const },
          },
        }
      : undefined;

    // Helper to transform views
    type ViewWithColumns = Prisma.KanbanViewGetPayload<{
      include: typeof includeRelations;
    }>;
    const transformView = (view: ViewWithColumns): SerializedKanbanView => ({
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
      columns: params.includeColumns
        ? (view as PrismaViewWithColumns).columns.map((col) => ({
            id: col.id,
            title: col.title,
            order: col.order,
            color: col.color,
            viewId: col.viewId,
            createdAt: col.createdAt.toISOString(),
            updatedAt: col.updatedAt.toISOString(),
          }))
        : [],
    });

    const usePagination = wantsPagination(searchParams);

    let customViews: SerializedKanbanView[];
    let total: number;

    if (usePagination) {
      // PAGINATED MODE: Client requested pagination via query params
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 50,
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 50;
      const skip = (page - 1) * limit;

      // Parallel queries for performance
      const [totalCount, dbViews] = await Promise.all([
        prisma.kanbanView.count({ where }),
        prisma.kanbanView.findMany({
          where,
          include: includeRelations,
          orderBy: [{ isActive: "desc" }, { lastAccessedAt: "desc" }, { createdAt: "desc" }],
          skip,
          take: limit,
        }),
      ]);

      total = totalCount;
      customViews = dbViews.map(transformView);
    } else {
      // LEGACY MODE: No pagination params, return all views
      const dbViews = await prisma.kanbanView.findMany({
        where,
        include: includeRelations,
        orderBy: [{ isActive: "desc" }, { lastAccessedAt: "desc" }, { createdAt: "desc" }],
      });

      total = dbViews.length;
      customViews = dbViews.map(transformView);
    }

    // Get fiscal year start month from organization
    let fiscalYearStartMonth = 1;
    if (params.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: params.organizationId },
        select: { fiscalYearStartMonth: true },
      });
      fiscalYearStartMonth = org?.fiscalYearStartMonth || 1;
    } else if (params.userId) {
      const userWithOrg = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { organization: { select: { fiscalYearStartMonth: true } } },
      });
      fiscalYearStartMonth = userWithOrg?.organization?.fiscalYearStartMonth || 1;
    }

    // Add built-in views
    const builtInViews = getAllBuiltInViews(
      fiscalYearStartMonth,
      params.userId || undefined,
      params.organizationId || undefined
    );

    // Combine built-in and custom views (built-in first)
    const allViews = [...builtInViews, ...customViews];

    if (usePagination) {
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 50,
      });
      return cachedResponse(
        buildPaginatedResponse(allViews, parsed.page, parsed.limit ?? 50, total + builtInViews.length, 'views'),
        'frequent'
      );
    } else {
      return cachedResponse(buildLegacyResponse(allViews, 'views'), 'frequent');
    }
  } catch (error) {
    console.error("Error fetching views:", error);

    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to fetch views" }, { status: 500 });
  }
}

/**
 * POST /api/v1/views
 * Create a new custom view
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth();

    const body = await request.json();
    const validatedData = viewCreateSchema.parse(body);

    // Default to authenticated user's ID
    const userId = validatedData.userId || user.id;

    // Authorization: user can only create views for themselves
    if (userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: Cannot create views for other users" },
        { status: 403 }
      );
    }

    // Check view count limit
    const where: PrismaWhereClause = { userId: user.id };

    const existingViewCount = await prisma.kanbanView.count({ where });

    if (existingViewCount >= MAX_VIEWS_PER_USER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_VIEWS_PER_USER} views per user/organization` },
        { status: 400 }
      );
    }

    // Check for duplicate name
    const existingView = await prisma.kanbanView.findFirst({
      where: {
        ...where,
        name: validatedData.name,
      },
    });

    if (existingView) {
      return NextResponse.json({ error: "View name already exists" }, { status: 400 });
    }

    // If this is the first view or isDefault is true, deactivate other default views
    if (validatedData.isDefault || existingViewCount === 0) {
      await prisma.kanbanView.updateMany({
        where,
        data: { isDefault: false },
      });
    }

    // Create view
    const view = await prisma.kanbanView.create({
      data: {
        name: validatedData.name,
        viewType: validatedData.viewType,
        userId: validatedData.userId || null,
        organizationId: validatedData.organizationId || null,
        isDefault: validatedData.isDefault || existingViewCount === 0,
        isActive: true, // New views are automatically activated
      },
      include: {
        columns: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Deactivate other views for this user/org
    await prisma.kanbanView.updateMany({
      where: {
        ...where,
        id: { not: view.id },
      },
      data: { isActive: false },
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

    return NextResponse.json({ view: serializedView }, { status: 201 });
  } catch (error) {
    console.error("Error creating view:", error);

    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create view" }, { status: 500 });
  }
}
