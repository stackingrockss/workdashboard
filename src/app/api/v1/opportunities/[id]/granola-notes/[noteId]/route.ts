import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { granolaUpdateSchema } from "@/lib/validations/granola-note";

// PATCH /api/v1/opportunities/[id]/granola-notes/[noteId] - Update a granola note
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params;
  try {
    const json = await req.json();
    const parsed = granolaUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify note exists and belongs to this opportunity
    const existingNote = await prisma.granolaNote.findUnique({
      where: { id: noteId },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Granola note not found" }, { status: 404 });
    }

    if (existingNote.opportunityId !== id) {
      return NextResponse.json(
        { error: "Granola note does not belong to this opportunity" },
        { status: 400 }
      );
    }

    const updatedNote = await prisma.granolaNote.update({
      where: { id: noteId },
      data: {
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.url !== undefined && { url: parsed.data.url }),
        ...(parsed.data.meetingDate !== undefined && {
          meetingDate: new Date(parsed.data.meetingDate),
        }),
        ...(parsed.data.noteType !== undefined && { noteType: parsed.data.noteType }),
        ...(parsed.data.calendarEventId !== undefined && {
          calendarEventId: parsed.data.calendarEventId,
        }),
        ...(parsed.data.transcriptText !== undefined && {
          transcriptText: parsed.data.transcriptText,
        }),
        // Editable insight fields
        ...(parsed.data.painPoints !== undefined && { painPoints: parsed.data.painPoints }),
        ...(parsed.data.goals !== undefined && { goals: parsed.data.goals }),
        ...(parsed.data.nextSteps !== undefined && { nextSteps: parsed.data.nextSteps }),
      },
    });

    // Revalidate the opportunity detail page
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ note: updatedNote });
  } catch {
    return NextResponse.json({ error: "Failed to update Granola note" }, { status: 500 });
  }
}

// DELETE /api/v1/opportunities/[id]/granola-notes/[noteId] - Delete a granola note
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params;
  try {
    // Verify note exists and belongs to this opportunity
    const existingNote = await prisma.granolaNote.findUnique({
      where: { id: noteId },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Granola note not found" }, { status: 404 });
    }

    if (existingNote.opportunityId !== id) {
      return NextResponse.json(
        { error: "Granola note does not belong to this opportunity" },
        { status: 400 }
      );
    }

    await prisma.granolaNote.delete({
      where: { id: noteId },
    });

    // Revalidate the opportunity detail page
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete Granola note" }, { status: 500 });
  }
}
