import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accountCreateSchema } from "@/lib/validations/account";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Get accounts that have opportunities owned by the current user
    const accounts = await prisma.account.findMany({
      where: {
        opportunities: {
          some: {
            ownerId: user.id,
          },
        },
      },
      include: {
        opportunities: {
          where: {
            ownerId: user.id,
          },
          select: {
            id: true,
            name: true,
            amountArr: true,
            probability: true,
            stage: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ accounts }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(); // Just verify authentication, accounts aren't user-specific

    const body = await request.json();
    const data = accountCreateSchema.parse(body);

    const account = await prisma.account.create({
      data: {
        name: data.name,
        industry: data.industry,
        priority: data.priority,
        health: data.health,
        notes: data.notes,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
