import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// DELETE /api/v1/opportunities/[id]/google-notes/[noteId] - Delete a specific Google note
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { noteId } = await params;
  try {
    await prisma.googleNote.delete({
      where: { id: noteId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete Google note" }, { status: 500 });
  }
}
