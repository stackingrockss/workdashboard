import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { ParsingStatus } from "@prisma/client";

// POST /api/v1/granola-notes/[id]/retry-parsing - Retry failed parsing
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const note = await prisma.granolaNote.findUnique({
      where: { id },
      select: { id: true, transcriptText: true, opportunityId: true },
    });

    if (!note) {
      return NextResponse.json({ error: "Granola note not found" }, { status: 404 });
    }

    if (!note.transcriptText) {
      return NextResponse.json(
        { error: "No transcript text available" },
        { status: 400 }
      );
    }

    // Reset status to pending
    await prisma.granolaNote.update({
      where: { id },
      data: {
        parsingStatus: ParsingStatus.pending,
        parsingError: null,
      },
    });

    // Trigger parsing
    await inngest.send({
      name: "granola/transcript.parse",
      data: { granolaId: id },
    });

    return NextResponse.json({
      success: true,
      message: "Parsing retry triggered",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to retry parsing" },
      { status: 500 }
    );
  }
}
