import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

// DELETE /api/v1/opportunities/[id]/google-notes/[noteId] - Delete a specific Google note
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params;
  try {
    await prisma.googleNote.delete({
      where: { id: noteId },
    });

    // Revalidate the opportunity detail page to reflect deletion immediately
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete Google note" }, { status: 500 });
  }
}
