import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { granolaCreateSchema } from "@/lib/validations/granola-note";

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
  } catch (error) {
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

    const note = await prisma.granolaNote.create({
      data: {
        opportunityId: id,
        title: parsed.data.title,
        url: parsed.data.url,
        meetingDate: new Date(parsed.data.meetingDate),
      },
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create Granola note" }, { status: 500 });
  }
}
