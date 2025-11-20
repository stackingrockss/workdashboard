import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/v1/sec-filings/[id] - Get single SEC filing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const filing = await prisma.secFiling.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            ticker: true,
          },
        },
      },
    });

    if (!filing || filing.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "SEC filing not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ filing });
  } catch (error) {
    console.error("Error fetching SEC filing:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch SEC filing" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/sec-filings/[id] - Delete SEC filing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const filing = await prisma.secFiling.findUnique({
      where: { id },
    });

    if (!filing || filing.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "SEC filing not found" },
        { status: 404 }
      );
    }

    await prisma.secFiling.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting SEC filing:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to delete SEC filing" },
      { status: 500 }
    );
  }
}
