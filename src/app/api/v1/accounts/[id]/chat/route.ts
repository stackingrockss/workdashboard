import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { buildAccountContext } from "@/lib/ai/chat-context";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { chatRequestSchema } from "@/lib/validations/chat";
import { checkRateLimit } from "@/lib/rate-limit";
import { ZodError } from "zod";
import { generateContentSuggestionsForAccount } from "@/lib/ai/content-suggestion";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Use stable model by default, allow override via env variable
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3-pro-preview";

// Streaming timeout (60 seconds)
const STREAM_TIMEOUT_MS = 60 * 1000;

const SYSTEM_INSTRUCTION = `You are a knowledgeable sales assistant for Verifiable, helping sales representatives understand and manage their accounts.

**Your role**:
- Answer questions about the account, its opportunities, contacts, and business context
- Provide insights from earnings transcripts, SEC filings, and sales activities
- Help identify account health, growth opportunities, and expansion strategies
- Be concise, actionable, and data-driven in your responses
- Reference specific data points from the context when relevant

**Guidelines**:
- Keep responses focused and actionable (2-4 paragraphs max unless asked for detail)
- Highlight key opportunities or concerns about the account
- Suggest specific next steps or strategies when appropriate
- For multi-opportunity accounts, consider the overall account relationship
- If you don't have enough information, say so clearly
- Use bullet points for lists and actionable items

The context provided includes all available information about this account. If something isn't in the context, it hasn't been captured in the system yet.`;

/**
 * Detect if user message is requesting content suggestions
 */
function isContentSuggestionRequest(message: string): boolean {
  const triggers = [
    "suggest content",
    "recommend content",
    "what content",
    "share with them",
    "send them",
    "collateral",
    "case study",
    "whitepaper",
    "blog post",
    "video",
    "content to share",
    "materials to send",
  ];
  const lowerMessage = message.toLowerCase();
  return triggers.some((trigger) => lowerMessage.includes(trigger));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params;
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
        role: true,
      },
    });

    if (!user || !user.organizationId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check rate limit (10 requests per minute per user)
    const rateLimitKey = `chat:account:${user.id}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      maxRequests: 10,
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
      validatedData = chatRequestSchema.parse(body);
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

    const { message, history } = validatedData;

    // Verify account access
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Check if this is a content suggestion request
    if (isContentSuggestionRequest(message)) {
      // Generate content suggestions
      const result = await generateContentSuggestionsForAccount(
        accountId,
        user.organizationId,
        message
      );

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      // Format response with embedded content cards
      let formattedResponse = result.summary + "\n\n";

      for (const suggestion of result.suggestions) {
        const cardJson = JSON.stringify({
          source: suggestion.source,
          ...(suggestion.id && { id: suggestion.id }),
          title: suggestion.title,
          url: suggestion.url,
          contentType: suggestion.contentType,
          ...(suggestion.description && { description: suggestion.description }),
          relevanceReason: suggestion.relevanceReason,
        });
        formattedResponse += `[CONTENT_CARD]${cardJson}[/CONTENT_CARD]\n\n`;
      }

      // Create streaming response
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(formattedResponse));
          controller.close();
        },
      });

      // Save conversation to database
      try {
        await prisma.$transaction([
          prisma.chatMessage.create({
            data: {
              accountId,
              userId: user.id,
              role: "user",
              content: message,
              contextSize: 0,
            },
          }),
          prisma.chatMessage.create({
            data: {
              accountId,
              userId: user.id,
              role: "assistant",
              content: formattedResponse,
            },
          }),
        ]);
      } catch (dbError) {
        console.error("[Chat API] Failed to save content suggestion messages:", dbError);
      }

      // Return streaming response
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "X-RateLimit-Limit": String(rateLimit.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
          "X-RateLimit-Reset": String(rateLimit.resetAt),
        },
      });
    }

    // Regular chat flow (existing code)
    // Build context
    const { context, size } = await buildAccountContext(accountId, user.organizationId);

    // Prepare chat history for Gemini
    const geminiHistory = history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Create Gemini model with system instruction
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    // Start chat session with history
    const chat = model.startChat({
      history: geminiHistory,
    });

    // Build the prompt with context
    const promptWithContext = `# Account Context

${context}

---

**User Question**: ${message}`;

    // Get streaming response
    const result = await chat.sendMessageStream(promptWithContext);

    // Create a ReadableStream for the response with timeout
    const stream = new ReadableStream({
      async start(controller) {
        const timeoutId = setTimeout(() => {
          controller.error(new Error("Stream timeout - request took too long"));
        }, STREAM_TIMEOUT_MS);

        try {
          let fullResponse = "";

          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullResponse += chunkText;

            // Send chunk to client
            controller.enqueue(new TextEncoder().encode(chunkText));
          }

          // Clear timeout - streaming completed successfully
          clearTimeout(timeoutId);

          // Save conversation to database
          try {
            await prisma.$transaction([
              // Save user message
              prisma.chatMessage.create({
                data: {
                  accountId,
                  userId: user.id,
                  role: "user",
                  content: message,
                  contextSize: size,
                },
              }),
              // Save assistant response
              prisma.chatMessage.create({
                data: {
                  accountId,
                  userId: user.id,
                  role: "assistant",
                  content: fullResponse,
                },
              }),
            ]);
          } catch (dbError) {
            // Log error but don't fail the request
            console.error("[Chat API] Failed to save chat messages:", {
              error: dbError,
              accountId,
              userId: user.id,
              messageLength: message.length,
              responseLength: fullResponse.length,
            });
          }

          controller.close();
        } catch (error) {
          clearTimeout(timeoutId);
          console.error("[Chat API] Streaming error:", {
            error,
            accountId,
            userId: user.id,
          });

          // Send error message to client
          const errorMessage = error instanceof Error ? error.message : "Unknown streaming error";
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
    console.error("[Chat API] Request error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to process chat request";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
