import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/ai/gemini";

/**
 * Test endpoint for Gemini integration
 * POST /api/v1/ai/test
 * Body: { prompt: string, model?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, model } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required and must be a string" },
        { status: 400 }
      );
    }

    const result = await generateText(prompt, model);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      response: result.text,
      model: model || "gemini-3-pro-preview",
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for testing basic connectivity
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Gemini test endpoint is available. Use POST with { prompt: string } to test.",
  });
}
