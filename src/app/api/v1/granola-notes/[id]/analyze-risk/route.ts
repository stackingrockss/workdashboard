import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

// POST /api/v1/granola-notes/[id]/analyze-risk - Trigger risk analysis
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const note = await prisma.granolaNote.findUnique({
      where: { id },
      select: { id: true, transcriptText: true },
    });

    if (!note) {
      return NextResponse.json({ error: "Granola note not found" }, { status: 404 });
    }

    if (!note.transcriptText) {
      return NextResponse.json(
        { error: "No transcript text available for risk analysis" },
        { status: 400 }
      );
    }

    // Trigger risk analysis
    await inngest.send({
      name: "granola/risk.analyze",
      data: { granolaId: id },
    });

    return NextResponse.json({
      success: true,
      message: "Risk analysis started",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to trigger risk analysis" },
      { status: 500 }
    );
  }
}
