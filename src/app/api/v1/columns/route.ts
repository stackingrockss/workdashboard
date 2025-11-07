import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { columnCreateSchema } from "@/lib/validations/column";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const viewId = searchParams.get("viewId");

    if (!viewId) {
      return NextResponse.json({ error: "viewId parameter is required" }, { status: 400 });
    }

    // Security: Verify view belongs to user's organization
    const view = await prisma.kanbanView.findFirst({
      where: {
        id: viewId,
        OR: [
          { userId: user.id },
          { organizationId: user.organization.id },
          { userId: null, organizationId: null }, // Global/built-in views
        ],
      },
    });

    if (!view) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    // Fetch columns for this view
    const columns = await prisma.kanbanColumn.findMany({
      where: {
        viewId,
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ columns });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch columns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();

    // Check if this is a batch create request (array of columns)
    const isBatch = Array.isArray(json);

    if (isBatch) {
      // Batch create schema
      const batchSchema = z.array(columnCreateSchema);
      const parsed = batchSchema.safeParse(json);

      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      // Validate all columns belong to the same view and user has access
      const viewIds = [...new Set(parsed.data.map((col) => col.viewId))];
      if (viewIds.length !== 1) {
        return NextResponse.json({ error: "All columns must belong to the same view" }, { status: 400 });
      }

      const viewId = viewIds[0];

      // Security: Verify view belongs to user's organization
      const view = await prisma.kanbanView.findFirst({
        where: {
          id: viewId,
          OR: [
            { userId: user.id },
            { organizationId: user.organization.id },
          ],
        },
      });

      if (!view) {
        return NextResponse.json({ error: "View not found or access denied" }, { status: 404 });
      }

      // Get the current max order for this view
      const maxOrderColumn = await prisma.kanbanColumn.findFirst({
        where: { viewId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const maxOrder = maxOrderColumn?.order ?? -1;

      // Create all columns in a transaction
      const columns = await prisma.$transaction(
        parsed.data.map((col, index) =>
          prisma.kanbanColumn.create({
            data: {
              id: crypto.randomUUID(),
              title: col.title,
              order: maxOrder + 1 + index, // Append sequentially after max order
              color: col.color,
              viewId: col.viewId,
            },
          })
        )
      );

      return NextResponse.json({ columns }, { status: 201 });
    } else {
      // Single column create
      const parsed = columnCreateSchema.safeParse(json);

      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const data = parsed.data;

      // Security: Verify view belongs to user's organization
      const view = await prisma.kanbanView.findFirst({
        where: {
          id: data.viewId,
          OR: [
            { userId: user.id },
            { organizationId: user.organization.id },
          ],
        },
      });

      if (!view) {
        return NextResponse.json({ error: "View not found or access denied" }, { status: 404 });
      }

      // Get the current max order for this view to avoid conflicts during batch creation
      const maxOrderColumn = await prisma.kanbanColumn.findFirst({
        where: { viewId: data.viewId },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      const maxOrder = maxOrderColumn?.order ?? -1;

      // If the requested order conflicts with existing columns, append to the end
      let finalOrder = data.order;
      if (data.order <= maxOrder) {
        finalOrder = maxOrder + 1;
      }

      const column = await prisma.kanbanColumn.create({
        data: {
          id: crypto.randomUUID(),
          title: data.title,
          order: finalOrder,
          color: data.color,
          viewId: data.viewId,
        },
      });

      return NextResponse.json({ column }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create column" }, { status: 500 });
  }
}
