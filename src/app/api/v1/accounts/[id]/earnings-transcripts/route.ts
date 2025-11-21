import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { earningsTranscriptCreateSchema } from "@/lib/validations/earnings-transcript";
import { inngest } from "@/lib/inngest/client";
import { TranscriptProcessingStatus } from "@prisma/client";

// Force dynamic rendering and Node.js runtime
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/v1/accounts/[id]/earnings-transcripts - List all earnings transcripts for an account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: accountId } = await params;

    // Verify account exists and belongs to user's organization
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || account.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const fiscalYear = searchParams.get("fiscalYear")
      ? parseInt(searchParams.get("fiscalYear")!)
      : undefined;
    const quarter = searchParams.get("quarter") || undefined;
    const processingStatus = searchParams.get(
      "processingStatus"
    ) as TranscriptProcessingStatus | undefined;

    // Fetch earnings transcripts with optional filters
    const transcripts = await prisma.earningsCallTranscript.findMany({
      where: {
        accountId,
        organizationId: user.organization.id,
        ...(fiscalYear && { fiscalYear }),
        ...(quarter && { quarter }),
        ...(processingStatus && { processingStatus }),
      },
      include: {
        opportunity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        callDate: "desc",
      },
    });

    return NextResponse.json({ transcripts });
  } catch (error) {
    console.error("Error fetching earnings transcripts:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name,
      accountId: (await params).id,
    });

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch earnings transcripts" },
      { status: 500 }
    );
  }
}

// POST /api/v1/accounts/[id]/earnings-transcripts - Fetch or create earnings transcript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: accountId } = await params;
    const body = await request.json();

    // Verify account exists and belongs to user's organization
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || account.organizationId !== user.organization.id) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Validate input
    const validatedData = earningsTranscriptCreateSchema.parse(body);

    // Check if transcript already exists for this quarter/year
    const existingTranscript = await prisma.earningsCallTranscript.findUnique({
      where: {
        accountId_fiscalYear_quarter: {
          accountId,
          fiscalYear: validatedData.fiscalYear,
          quarter: validatedData.quarter,
        },
      },
    });

    if (existingTranscript) {
      return NextResponse.json(
        {
          error: "Transcript already exists for this quarter and year",
          transcript: existingTranscript,
        },
        { status: 409 }
      );
    }

    // Generate title if not provided
    const title =
      validatedData.title ||
      `${account.name} ${validatedData.quarter} ${validatedData.fiscalYear} Earnings Call`;

    // Determine call date (use provided or estimate)
    const callDate = validatedData.callDate
      ? new Date(validatedData.callDate)
      : estimateCallDate(validatedData.fiscalYear, validatedData.quarter);

    // Create earnings transcript record
    const transcript = await prisma.earningsCallTranscript.create({
      data: {
        accountId,
        organizationId: user.organization.id,
        quarter: validatedData.quarter,
        fiscalYear: validatedData.fiscalYear,
        callDate,
        title,
        source: validatedData.source,
        sourceUrl: validatedData.sourceUrl,
        transcriptText: validatedData.transcriptText, // May be null if fetching from API
        processingStatus: TranscriptProcessingStatus.pending,
      },
    });

    // Trigger background job to fetch (if needed) and parse transcript
    try {
      if (!process.env.INNGEST_EVENT_KEY) {
        console.warn("INNGEST_EVENT_KEY not configured - background job will not be triggered");
      }
      await inngest.send({
        name: "earnings/transcript.process",
        data: { transcriptId: transcript.id },
      });
    } catch (inngestError) {
      console.error("Inngest trigger failed:", inngestError);
      // Continue - transcript is created, job can be triggered manually
    }

    return NextResponse.json({ transcript }, { status: 201 });
  } catch (error) {
    console.error("Error creating earnings transcript:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      type: error?.constructor?.name,
      accountId: (await params).id,
    });

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
      { error: "Failed to create earnings transcript" },
      { status: 500 }
    );
  }
}

/**
 * Estimate earnings call date based on fiscal year and quarter
 * Typically earnings calls happen 4-6 weeks after quarter end
 */
function estimateCallDate(fiscalYear: number, quarter: string): Date {
  const quarterMap: Record<string, number> = {
    Q1: 3, // End of March
    Q2: 6, // End of June
    Q3: 9, // End of September
    Q4: 12, // End of December
  };

  const quarterEndMonth = quarterMap[quarter];
  // Add 5 weeks (35 days) after quarter end as estimate
  const estimatedDate = new Date(fiscalYear, quarterEndMonth, 5);

  return estimatedDate;
}
