import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accountCreateSchema } from "@/lib/validations/account";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireAuth();

    // Get accounts within user's organization
    const accounts = await prisma.account.findMany({
      where: {
        organizationId: user.organization.id,
      },
      include: {
        opportunities: {
          select: {
            id: true,
            name: true,
            amountArr: true,
            confidenceLevel: true,
            stage: true,
          },
        },
        owner: true,
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
    const user = await requireAuth();

    const body = await request.json();
    const data = accountCreateSchema.parse(body);

    const account = await prisma.account.create({
      data: {
        name: data.name,
        industry: data.industry,
        priority: data.priority,
        health: data.health,
        notes: data.notes,
        organizationId: user.organization.id, // Required field
        ownerId: data.ownerId ?? user.id, // Use provided ownerId or default to current user
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
