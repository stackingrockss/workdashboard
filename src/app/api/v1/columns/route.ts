import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { columnCreateSchema } from "@/lib/validations/column";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    const columns = await prisma.kanbanColumn.findMany({
      where: userId ? { userId } : { userId: null },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ columns });
  } catch (error) {
    console.error("Error fetching columns:", error);
    return NextResponse.json({ error: "Failed to fetch columns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = columnCreateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Check if order already exists for this user
    const existingColumn = await prisma.kanbanColumn.findFirst({
      where: {
        userId: data.userId ?? null,
        order: data.order,
      },
    });

    if (existingColumn) {
      // Shift all columns at or after this order
      await prisma.kanbanColumn.updateMany({
        where: {
          userId: data.userId ?? null,
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
        userId: data.userId,
      },
    });

    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    console.error("Error creating column:", error);
    return NextResponse.json({ error: "Failed to create column" }, { status: 500 });
  }
}
