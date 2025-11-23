import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { granolaUpdateSchema } from "@/lib/validations/granola-note";
import { requireAuth } from "@/lib/auth";

// PATCH /api/v1/opportunities/[id]/granola-notes/[noteId] - Update a Granola note (e.g., link/unlink from calendar event)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params;
  try {
    const user = await requireAuth();

    const json = await req.json();
    const parsed = granolaUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify opportunity exists and belongs to user's organization
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id,
        organizationId: user.organization.id
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Verify Granola note exists and belongs to this opportunity
    const existingNote = await prisma.granolaNote.findFirst({
      where: {
        id: noteId,
        opportunityId: id,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Granola note not found" }, { status: 404 });
    }

    // Update the Granola note
    const updatedNote = await prisma.granolaNote.update({
      where: { id: noteId },
      data: parsed.data,
    });

    // Revalidate the opportunity detail page
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ note: updatedNote });
  } catch (error) {
    console.error('Failed to update Granola note:', error);
    return NextResponse.json({ error: "Failed to update Granola note" }, { status: 500 });
  }
}

// DELETE /api/v1/opportunities/[id]/granola-notes/[noteId] - Delete a specific granola note
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params;
  try {
    await prisma.granolaNote.delete({
      where: { id: noteId },
    });

    // Revalidate the opportunity detail page to reflect deletion immediately
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete Granola note" }, { status: 500 });
  }
}
