import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { columnCreateSchema } from "@/lib/validations/column";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Fetch user-specific columns and global columns (userId: null)
    const columns = await prisma.kanbanColumn.findMany({
      where: {
        OR: [{ userId: user.id }, { userId: null }],
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ columns });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching columns:", error);
    return NextResponse.json({ error: "Failed to fetch columns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = columnCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Check if order already exists for this user
    const existingColumn = await prisma.kanbanColumn.findFirst({
      where: {
        userId: user.id,
        order: data.order,
      },
    });

    if (existingColumn) {
      // Shift all columns at or after this order
      await prisma.kanbanColumn.updateMany({
        where: {
          userId: user.id,
          order: { gte: data.order },
        },
        data: {
          order: { increment: 1 },
        },
      });
    }

    const column = await prisma.kanbanColumn.create({
      data: {
        title: data.title,
        order: data.order,
        color: data.color,
        userId: user.id, // Use authenticated user's ID
      },
    });

    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating column:", error);
    return NextResponse.json({ error: "Failed to create column" }, { status: 500 });
  }
}
