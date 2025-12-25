import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiWritingRequestSchema } from "@/lib/validations/editor";
import { checkRateLimit } from "@/lib/rate-limit";
import { ZodError } from "zod";
import { buildOpportunityContext } from "@/lib/ai/chat-context";
import {
  AI_SYSTEM_INSTRUCTIONS,
  TONE_INSTRUCTIONS,
} from "@/types/editor";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Use stable model by default
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash";

// Streaming timeout (60 seconds)
const STREAM_TIMEOUT_MS = 60 * 1000;

/**
 * Build system instruction based on action and context
 */
function buildSystemInstruction(
  action: string,
  tone?: string,
  hasContext?: boolean
): string {
  let instruction = AI_SYSTEM_INSTRUCTIONS[action as keyof typeof AI_SYSTEM_INSTRUCTIONS];

  if (action === "tone" && tone) {
    instruction += `\n\nTarget Tone: ${TONE_INSTRUCTIONS[tone as keyof typeof TONE_INSTRUCTIONS]}`;
  }

  if (hasContext) {
    instruction += `\n\nYou have access to opportunity context including customer pain points, goals, contacts, and meeting insights. Use this context to make the content more relevant and specific.`;
  }

  return instruction;
}

/**
 * Build the prompt for AI
 */
function buildPrompt(
  action: string,
  text?: string,
  prompt?: string,
  tone?: string,
  documentContext?: string,
  opportunityContext?: string
): string {
  const parts: string[] = [];

  // Add opportunity context if available
  if (opportunityContext) {
    parts.push(`## Opportunity Context\n\n${opportunityContext}\n\n---\n`);
  }

  // Add document context if available
  if (documentContext) {
    parts.push(`## Document Context\n\n${documentContext}\n\n---\n`);
  }

  // Build the main request
  switch (action) {
    case "generate":
      parts.push(`## Request\n\nGenerate content based on this prompt:\n\n${prompt}`);
      break;
    case "improve":
      parts.push(`## Request\n\nImprove the following text:\n\n${text}`);
      break;
    case "expand":
      parts.push(`## Request\n\nExpand the following text with more detail:\n\n${text}`);
      break;
    case "shorten":
      parts.push(`## Request\n\nShorten the following text to key points:\n\n${text}`);
      break;
    case "tone":
      parts.push(
        `## Request\n\nRewrite the following text in a ${tone} tone:\n\n${text}`
      );
      break;
    default:
      parts.push(`## Request\n\n${text || prompt}`);
  }

  return parts.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check rate limit (20 requests per minute per user for editor AI)
    const rateLimitKey = `editor:ai:${user.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      maxRequests: 20,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.success) {
      const resetInSeconds = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please try again in ${resetInSeconds} seconds.`,
          retryAfter: resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(resetInSeconds),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    let validatedData;

    try {
      validatedData = aiWritingRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        return NextResponse.json(
          { error: firstError.message },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    const { action, text, prompt, tone, opportunityId, documentContext } =
      validatedData;

    // Build opportunity context if opportunityId is provided
    let opportunityContext: string | undefined;
    if (opportunityId) {
      try {
        const contextResult = await buildOpportunityContext(
          opportunityId,
          user.organizationId
        );
        opportunityContext = contextResult.context;
      } catch (error) {
        console.warn("[Editor AI] Failed to build opportunity context:", error);
        // Continue without opportunity context
      }
    }

    // Build system instruction
    const systemInstruction = buildSystemInstruction(
      action,
      tone,
      !!opportunityContext
    );

    // Build prompt
    const fullPrompt = buildPrompt(
      action,
      text,
      prompt,
      tone,
      documentContext,
      opportunityContext
    );

    // Create Gemini model with system instruction
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction,
    });

    // Get streaming response
    const result = await model.generateContentStream(fullPrompt);

    // Create a ReadableStream for the response with timeout
    const stream = new ReadableStream({
      async start(controller) {
        const timeoutId = setTimeout(() => {
          controller.error(new Error("Stream timeout - request took too long"));
        }, STREAM_TIMEOUT_MS);

        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();

            // Send chunk to client
            controller.enqueue(new TextEncoder().encode(chunkText));
          }

          // Clear timeout - streaming completed successfully
          clearTimeout(timeoutId);
          controller.close();
        } catch (error) {
          clearTimeout(timeoutId);
          console.error("[Editor AI] Streaming error:", {
            error,
            userId: user.id,
            action,
          });

          // Send error message to client
          const errorMessage =
            error instanceof Error ? error.message : "Unknown streaming error";
          controller.error(new Error(`Streaming failed: ${errorMessage}`));
        }
      },
    });

    // Return streaming response with rate limit headers
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.resetAt),
      },
    });
  } catch (error) {
    console.error("[Editor AI] Request error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to process AI request";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
