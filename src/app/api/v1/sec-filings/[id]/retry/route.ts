import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { inngest } from "@/lib/inngest/client";
import { FilingProcessingStatus } from "@prisma/client";

// POST /api/v1/sec-filings/[id]/retry - Retry failed filing processing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const filing = await prisma.secFiling.findUnique({
      where: { id },
    });

    if (!filing || filing.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "SEC filing not found" },
        { status: 404 }
      );
    }

    if (filing.processingStatus === FilingProcessingStatus.processing) {
      return NextResponse.json(
        { error: "Filing is already being processed" },
        { status: 400 }
      );
    }

    // Reset status to pending
    await prisma.secFiling.update({
      where: { id },
      data: {
        processingStatus: FilingProcessingStatus.pending,
        processingError: null,
      },
    });

    // Trigger background job
    await inngest.send({
      name: "sec/filing.process",
      data: { filingId: filing.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error retrying SEC filing:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to retry SEC filing processing" },
      { status: 500 }
    );
  }
}
