import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeCallRisk } from "@/lib/ai/analyze-call-risk";

/**
 * POST /api/v1/gong-calls/[id]/analyze-risk
 * Manually trigger risk analysis for a specific Gong call
 * Useful for debugging or backfilling calls that were parsed before risk analysis feature existed
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Fetch the call
    const call = await prisma.gongCall.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        transcriptText: true,
        parsingStatus: true,
        riskAssessment: true,
      },
    });

    if (!call) {
      return NextResponse.json(
        { error: "Gong call not found" },
        { status: 404 }
      );
    }

    if (!call.transcriptText) {
      return NextResponse.json(
        { error: "No transcript text available for this call" },
        { status: 400 }
      );
    }

    if (call.parsingStatus !== "completed") {
      return NextResponse.json(
        { error: `Call parsing status is ${call.parsingStatus}, not completed` },
        { status: 400 }
      );
    }

    // Run risk analysis
    console.log(`Running risk analysis for call ${id}: ${call.title}`);
    const result = await analyzeCallRisk(call.transcriptText);

    if (!result.success || !result.data) {
      console.error(`Risk analysis failed for call ${id}:`, result.error);
      return NextResponse.json(
        {
          error: "Risk analysis failed",
          details: result.error,
          callId: id,
          callTitle: call.title,
        },
        { status: 500 }
      );
    }

    // Save to database
    const updatedCall = await prisma.gongCall.update({
      where: { id },
      data: {
        riskAssessment: JSON.parse(JSON.stringify(result.data)),
      },
      select: {
        id: true,
        title: true,
        riskAssessment: true,
      },
    });

    console.log(`✅ Risk analysis completed for call ${id}`);

    return NextResponse.json({
      success: true,
      callId: id,
      callTitle: call.title,
      riskAssessment: result.data,
      alreadyHadRisk: !!call.riskAssessment,
    });
  } catch (error) {
    console.error(`Error analyzing risk for call ${id}:`, error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
