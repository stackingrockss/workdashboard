import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { columnUpdateSchema } from "@/lib/validations/column";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();
    const json = await req.json();
    const parsed = columnUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Security: Verify column belongs to user's organization via view
    const currentColumn = await prisma.kanbanColumn.findFirst({
      where: { id },
      include: {
        KanbanView: true,
      },
    });

    if (!currentColumn) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    // Check if user has access to the view this column belongs to
    const view = currentColumn.KanbanView;
    const hasAccess =
      view.userId === user.id ||
      view.organizationId === user.organization.id ||
      (view.userId === null && view.organizationId === null); // Built-in views

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // If order is being changed, handle reordering
    if (data.order !== undefined) {
      const oldOrder = currentColumn.order;
      const newOrder = data.order;

      if (oldOrder !== newOrder) {
        // Shift other columns within the same view
        if (newOrder > oldOrder) {
          // Moving down: decrease order of columns in between
          await prisma.kanbanColumn.updateMany({
            where: {
              viewId: currentColumn.viewId,
              order: { gt: oldOrder, lte: newOrder },
            },
            data: { order: { decrement: 1 } },
          });
        } else {
          // Moving up: increase order of columns in between
          await prisma.kanbanColumn.updateMany({
            where: {
              viewId: currentColumn.viewId,
              order: { gte: newOrder, lt: oldOrder },
            },
            data: { order: { increment: 1 } },
          });
        }
      }
    }

    const updated = await prisma.kanbanColumn.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });

    return NextResponse.json({ column: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update column" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireAuth();

    // Security: Verify column belongs to user's organization via view
    const column = await prisma.kanbanColumn.findFirst({
      where: { id },
      include: {
        KanbanView: true,
      },
    });

    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    // Check if user has access to the view this column belongs to
    const view = column.KanbanView;
    const hasAccess =
      view.userId === user.id ||
      view.organizationId === user.organization.id ||
      (view.userId === null && view.organizationId === null); // Built-in views

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Unassign all opportunities from this column
    await prisma.opportunity.updateMany({
      where: { columnId: id },
      data: { columnId: null },
    });

    // Delete the column
    await prisma.kanbanColumn.delete({
      where: { id },
    });

    // Shift remaining columns to fill the gap
    await prisma.kanbanColumn.updateMany({
      where: {
        viewId: column.viewId,
        order: { gt: column.order },
      },
      data: {
        order: { decrement: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete column" }, { status: 500 });
  }
}
