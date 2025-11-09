/**
 * POST /api/v1/ai/parse-gong-transcript
 *
 * Triggers background parsing of a Gong call transcript to extract:
 * - Pain points / challenges
 * - Goals / future state
 * - People (participants + mentioned)
 * - Next steps / action items
 *
 * This endpoint immediately returns after saving the transcript and triggering background processing.
 * Clients should poll the GongCall status to know when parsing is complete.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { triggerTranscriptParsingAsync } from "@/lib/ai/background-transcript-parsing";
import { prisma } from "@/lib/db";
import { ParsingStatus } from "@prisma/client";

// ============================================================================
// Validation Schema
// ============================================================================

const parseRequestSchema = z.object({
  transcriptText: z
    .string()
    .min(100, "Transcript must be at least 100 characters")
    .max(100000, "Transcript exceeds maximum length of 100,000 characters"),
  gongCallId: z.string().cuid(), // Required: GongCall ID to save parsed data and track status
});

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = parseRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { transcriptText, gongCallId } = validation.data;

    // Verify GongCall exists
    const gongCall = await prisma.gongCall.findUnique({
      where: { id: gongCallId },
    });

    if (!gongCall) {
      return NextResponse.json(
        {
          success: false,
          error: "Gong call not found",
        },
        { status: 404 }
      );
    }

    // Save transcript text and set status to 'parsing' immediately
    await prisma.gongCall.update({
      where: { id: gongCallId },
      data: {
        transcriptText,
        parsingStatus: ParsingStatus.parsing,
        parsingError: null,
      },
    });

    // Trigger background parsing (fire-and-forget)
    triggerTranscriptParsingAsync({ gongCallId, transcriptText });

    // Return immediately with status
    return NextResponse.json(
      {
        success: true,
        message: "Transcript parsing started in background",
        status: ParsingStatus.parsing,
        gongCallId,
      },
      { status: 202 } // 202 Accepted - processing in background
    );
  } catch (error) {
    console.error("Error in parse-gong-transcript endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
