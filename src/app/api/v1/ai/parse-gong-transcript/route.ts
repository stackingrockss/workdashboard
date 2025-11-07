/**
 * POST /api/v1/ai/parse-gong-transcript
 *
 * Parses a Gong call transcript to extract:
 * - Pain points / challenges
 * - Goals / future state
 * - People (participants + mentioned)
 * - Next steps / action items
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseGongTranscript } from "@/lib/ai/parse-gong-transcript";

// ============================================================================
// Validation Schema
// ============================================================================

const parseRequestSchema = z.object({
  transcriptText: z
    .string()
    .min(100, "Transcript must be at least 100 characters")
    .max(100000, "Transcript exceeds maximum length of 100,000 characters"),
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

    const { transcriptText } = validation.data;

    // Parse transcript using Gemini
    const result = await parseGongTranscript(transcriptText);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to parse transcript",
        },
        { status: 500 }
      );
    }

    // Return parsed data
    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 200 }
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
