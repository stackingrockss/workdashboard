import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accountUpdateSchema } from "@/lib/validations/account";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        opportunities: {
          include: {
            owner: true,
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ account }, { status: 200 });
  } catch (error) {
    console.error("Error fetching account:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = accountUpdateSchema.parse(body);

    const account = await prisma.account.update({
      where: { id },
      data: {
        name: data.name,
        website: data.website,
        industry: data.industry,
        priority: data.priority,
        health: data.health,
        notes: data.notes,
      },
    });

    return NextResponse.json({ account }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if account has opportunities
    const opportunityCount = await prisma.opportunity.count({
      where: { accountId: id },
    });

    if (opportunityCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with associated opportunities" },
        { status: 400 }
      );
    }

    await prisma.account.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
