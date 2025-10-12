import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { columnUpdateSchema } from "@/lib/validations/column";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const json = await req.json();
    const parsed = columnUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // If order is being changed, handle reordering
    if (data.order !== undefined) {
      const currentColumn = await prisma.kanbanColumn.findUnique({
        where: { id },
      });

      if (!currentColumn) {
        return NextResponse.json({ error: "Column not found" }, { status: 404 });
      }

      const oldOrder = currentColumn.order;
      const newOrder = data.order;

      if (oldOrder !== newOrder) {
        // Shift other columns
        if (newOrder > oldOrder) {
          // Moving down: decrease order of columns in between
          await prisma.kanbanColumn.updateMany({
            where: {
              userId: currentColumn.userId,
              order: { gt: oldOrder, lte: newOrder },
            },
            data: { order: { decrement: 1 } },
          });
        } else {
          // Moving up: increase order of columns in between
          await prisma.kanbanColumn.updateMany({
            where: {
              userId: currentColumn.userId,
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
    console.error("Error updating column:", error);
    return NextResponse.json({ error: "Failed to update column" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const column = await prisma.kanbanColumn.findUnique({
      where: { id },
    });

    if (!column) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    // Delete the column
    await prisma.kanbanColumn.delete({
      where: { id },
    });

    // Shift remaining columns to fill the gap
    await prisma.kanbanColumn.updateMany({
      where: {
        userId: column.userId,
        order: { gt: column.order },
      },
      data: {
        order: { decrement: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting column:", error);
    return NextResponse.json({ error: "Failed to delete column" }, { status: 500 });
  }
}
