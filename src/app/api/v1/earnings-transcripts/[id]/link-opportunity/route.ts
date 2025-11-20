import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { earningsTranscriptLinkSchema } from "@/lib/validations/earnings-transcript";

// PATCH /api/v1/earnings-transcripts/[id]/link-opportunity - Link transcript to opportunity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const transcript = await prisma.earningsCallTranscript.findUnique({
      where: { id },
    });

    if (!transcript || transcript.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "Earnings transcript not found" },
        { status: 404 }
      );
    }

    // Validate input
    const validatedData = earningsTranscriptLinkSchema.parse(body);

    // Verify opportunity exists and belongs to same organization
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: validatedData.opportunityId },
    });

    if (!opportunity || opportunity.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Update transcript with opportunity link
    const updatedTranscript = await prisma.earningsCallTranscript.update({
      where: { id },
      data: {
        opportunityId: validatedData.opportunityId,
      },
      include: {
        opportunity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ transcript: updatedTranscript });
  } catch (error) {
    console.error("Error linking earnings transcript to opportunity:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input data", details: error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to link earnings transcript to opportunity" },
      { status: 500 }
    );
  }
}
