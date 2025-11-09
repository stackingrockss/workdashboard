/**
 * POST /api/v1/ai/parse-gong-transcript
 *
 * Parses a Gong call transcript to extract:
 * - Pain points / challenges
 * - Goals / future state
 * - People (participants + mentioned)
 * - Next steps / action items
 *
 * If gongCallId is provided, saves parsed data to the GongCall record in the database.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseGongTranscript } from "@/lib/ai/parse-gong-transcript";
import { prisma } from "@/lib/db";

// ============================================================================
// Validation Schema
// ============================================================================

const parseRequestSchema = z.object({
  transcriptText: z
    .string()
    .min(100, "Transcript must be at least 100 characters")
    .max(100000, "Transcript exceeds maximum length of 100,000 characters"),
  gongCallId: z.string().cuid().optional(), // Optional: If provided, save parsed data to this GongCall
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

    // If gongCallId provided, verify it exists
    if (gongCallId) {
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
    }

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

    // If gongCallId provided, save parsed data to database
    if (gongCallId && result.data) {
      await prisma.gongCall.update({
        where: { id: gongCallId },
        data: {
          transcriptText,
          painPoints: JSON.parse(JSON.stringify(result.data.painPoints)),
          goals: JSON.parse(JSON.stringify(result.data.goals)),
          parsedPeople: JSON.parse(JSON.stringify(result.data.people)),
          nextSteps: JSON.parse(JSON.stringify(result.data.nextSteps)),
          parsedAt: new Date(),
        },
      });
    }

    // Return parsed data
    return NextResponse.json(
      {
        success: true,
        data: result.data,
        saved: !!gongCallId, // Indicate whether data was saved to database
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
