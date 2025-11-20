import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/v1/earnings-transcripts/[id] - Get single earnings transcript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const transcript = await prisma.earningsCallTranscript.findUnique({
      where: { id },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            ticker: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!transcript || transcript.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "Earnings transcript not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("Error fetching earnings transcript:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch earnings transcript" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/earnings-transcripts/[id] - Delete earnings transcript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const transcript = await prisma.earningsCallTranscript.findUnique({
      where: { id },
    });

    if (!transcript || transcript.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "Earnings transcript not found" },
        { status: 404 }
      );
    }

    await prisma.earningsCallTranscript.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting earnings transcript:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to delete earnings transcript" },
      { status: 500 }
    );
  }
}
