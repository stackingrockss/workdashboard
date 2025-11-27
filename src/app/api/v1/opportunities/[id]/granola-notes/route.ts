import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { granolaCreateSchema } from "@/lib/validations/granola-note";
import { inngest } from "@/lib/inngest/client";
import { ParsingStatus } from "@prisma/client";
import { recalculateNextCallDateForOpportunity } from "@/lib/utils/next-call-date-calculator";

// GET /api/v1/opportunities/[id]/granola-notes - List all granola notes for an opportunity
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const notes = await prisma.granolaNote.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ error: "Failed to fetch Granola notes" }, { status: 500 });
  }
}

// POST /api/v1/opportunities/[id]/granola-notes - Create a new granola note
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const json = await req.json();
    const parsed = granolaCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify opportunity exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
    });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Check for duplicate URL
    const existingNote = await prisma.granolaNote.findFirst({
      where: {
        opportunityId: id,
        url: parsed.data.url,
      },
    });

    if (existingNote) {
      return NextResponse.json(
        { error: "A Granola note with this URL already exists for this opportunity" },
        { status: 409 }
      );
    }

    const note = await prisma.granolaNote.create({
      data: {
        opportunityId: id,
        title: parsed.data.title,
        url: parsed.data.url,
        meetingDate: new Date(parsed.data.meetingDate),
        noteType: parsed.data.noteType,
        calendarEventId: parsed.data.calendarEventId,
        transcriptText: parsed.data.transcriptText,
        parsingStatus: parsed.data.transcriptText ? ParsingStatus.pending : null,
      },
    });

    // Trigger background parsing if transcript provided
    if (parsed.data.transcriptText) {
      await inngest.send({
        name: "granola/transcript.parse",
        data: { granolaId: note.id },
      });
    }

    // Recalculate next call date for the opportunity
    try {
      await recalculateNextCallDateForOpportunity(id);
    } catch (recalcError) {
      // Log but don't fail - recalculation will happen via background job
      console.error('[POST granola-note] Failed to recalculate next call date:', recalcError);
    }

    // Revalidate the opportunity detail page to show new note immediately
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ note }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create Granola note" }, { status: 500 });
  }
}
