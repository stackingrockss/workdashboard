import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { gongCallCreateSchema } from "@/lib/validations/gong-call";
import { triggerTranscriptParsingAsync } from "@/lib/ai/background-transcript-parsing";

// GET /api/v1/opportunities/[id]/gong-calls - List all Gong calls for an opportunity
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const calls = await prisma.gongCall.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ calls });
  } catch {
    return NextResponse.json({ error: "Failed to fetch Gong calls" }, { status: 500 });
  }
}

// POST /api/v1/opportunities/[id]/gong-calls - Create a new Gong call
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const json = await req.json();
    const parsed = gongCallCreateSchema.safeParse(json);
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

    // Create the call with optional transcript
    const call = await prisma.gongCall.create({
      data: {
        opportunityId: id,
        title: parsed.data.title,
        url: parsed.data.url,
        meetingDate: new Date(parsed.data.meetingDate),
        noteType: parsed.data.noteType,
        transcriptText: parsed.data.transcriptText,
        parsingStatus: parsed.data.transcriptText ? "parsing" : null,
      },
    });

    // If transcript was provided, trigger parsing in background
    if (parsed.data.transcriptText) {
      await triggerTranscriptParsingAsync({
        gongCallId: call.id,
        transcriptText: parsed.data.transcriptText,
      });
    }

    // Revalidate the opportunity detail page to show new call immediately
    revalidatePath(`/opportunities/${id}`);

    return NextResponse.json({ call }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create Gong call" }, { status: 500 });
  }
}
