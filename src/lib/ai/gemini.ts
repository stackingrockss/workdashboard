import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Lazy initialization of Gemini API client
let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }

    genAI = new GoogleGenerativeAI(apiKey);
  }

  return genAI;
}

/**
 * Get a Gemini model instance
 * @param modelName - The model to use (default: gemini-3-pro-preview)
 * @returns GenerativeModel instance
 */
export function getModel(modelName: string = "gemini-3-pro-preview"): GenerativeModel {
  return getGenAI().getGenerativeModel({ model: modelName });
}

/**
 * Response type for Gemini API calls
 */
export interface GeminiResponse {
  text: string;
  error?: string;
}

/**
 * Generate text using Gemini
 * @param prompt - The prompt to send to Gemini
 * @param modelName - Optional model name (default: gemini-3-pro-preview)
 * @returns Promise with the generated text or error
 */
export async function generateText(
  prompt: string,
  modelName?: string
): Promise<GeminiResponse> {
  try {
    const model = getModel(modelName);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return { text };
  } catch (error) {
    console.error("Gemini API error:", error);
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Sleep utility for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate structured content with system instructions
 * Includes retry logic for handling API overload (503 errors)
 * @param prompt - The user prompt
 * @param systemInstruction - System-level instructions for the model
 * @param modelName - Optional model name (default: gemini-3-pro-preview)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise with the generated text or error
 */
export async function generateWithSystemInstruction(
  prompt: string,
  systemInstruction: string,
  modelName: string = "gemini-3-pro-preview",
  maxRetries: number = 3
): Promise<GeminiResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = getGenAI().getGenerativeModel({
        model: modelName,
        systemInstruction,
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return { text };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error occurred");
      console.error(`Gemini API error (attempt ${attempt + 1}/${maxRetries}):`, error);

      // Check if it's a 503 Service Unavailable error
      const errorMessage = lastError.message.toLowerCase();
      const is503Error = errorMessage.includes("503") || errorMessage.includes("overloaded");

      // Only retry on 503 errors
      if (is503Error && attempt < maxRetries - 1) {
        // Exponential backoff with jitter: 3s, 6s, 12s (+ random 0-2s)
        const baseDelay = Math.pow(2, attempt + 1) * 1500;
        const jitter = Math.random() * 2000; // Random 0-2 seconds
        const delayMs = baseDelay + jitter;
        console.log(`Retrying after ${Math.round(delayMs / 1000)}s due to model overload...`);
        await sleep(delayMs);
        continue;
      }

      // For non-503 errors or final attempt, return the error
      break;
    }
  }

  return {
    text: "",
    error: lastError?.message || "Unknown error occurred",
  };
}

/**
 * Chat session type
 */
export interface ChatMessage {
  role: "user" | "model";
  parts: string;
}

/**
 * Create a chat session for multi-turn conversations
 * @param history - Optional chat history
 * @param modelName - Optional model name (default: gemini-3-pro-preview)
 * @returns Chat session
 */
export function createChatSession(
  history: ChatMessage[] = [],
  modelName?: string
) {
  const model = getModel(modelName);
  return model.startChat({
    history: history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.parts }],
    })),
  });
}

/**
 * Grounding metadata from Google Search
 */
export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: Array<{
    web?: {
      uri?: string;
      title?: string;
    };
  }>;
}

/**
 * Response type for web search-enabled Gemini API calls
 */
export interface GeminiWebSearchResponse {
  text: string;
  groundingMetadata?: {
    webSearchQueries: string[];
    sources: Array<{ uri: string; title: string }>;
  };
  error?: string;
}

/**
 * Generate content with Google Search grounding enabled
 * @param prompt - The user prompt
 * @param systemInstruction - System-level instructions for the model
 * @param modelName - Optional model name (default: gemini-2.5-flash)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Promise with the generated text and grounding metadata
 */
export async function generateWithWebSearch(
  prompt: string,
  systemInstruction: string,
  modelName: string = "gemini-2.5-flash",
  maxRetries: number = 3
): Promise<GeminiWebSearchResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const model = getGenAI().getGenerativeModel({
        model: modelName,
        systemInstruction,
      });

      // Generate content with Google Search grounding
      // Note: Temporarily disabled due to type incompatibility with @google/generative-ai
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        // tools: [
        //   {
        //     googleSearchRetrieval: {
        //       dynamicRetrievalConfig: {
        //         mode: 1, // MODE_DYNAMIC
        //         dynamicThreshold: 0.5, // Only search when confidence > 50%
        //       },
        //     },
        //   },
        // ],
      });

      const response = await result.response;
      const text = response.text();

      // Extract grounding metadata if available
      const candidate = response.candidates?.[0];
      const rawGroundingMetadata = candidate?.groundingMetadata as GroundingMetadata | undefined;

      let groundingMetadata;
      if (rawGroundingMetadata) {
        groundingMetadata = {
          webSearchQueries: rawGroundingMetadata.webSearchQueries || [],
          sources: (rawGroundingMetadata.groundingChunks || [])
            .filter((chunk) => chunk.web)
            .map((chunk) => ({
              uri: chunk.web!.uri || "",
              title: chunk.web!.title || "",
            })),
        };
      }

      return { text, groundingMetadata };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error occurred");
      console.error(`Gemini API error (attempt ${attempt + 1}/${maxRetries}):`, error);

      // Check if it's a 503 Service Unavailable error
      const errorMessage = lastError.message.toLowerCase();
      const is503Error = errorMessage.includes("503") || errorMessage.includes("overloaded");

      // Only retry on 503 errors
      if (is503Error && attempt < maxRetries - 1) {
        // Exponential backoff with jitter: 3s, 6s, 12s (+ random 0-2s)
        const baseDelay = Math.pow(2, attempt + 1) * 1500;
        const jitter = Math.random() * 2000; // Random 0-2 seconds
        const delayMs = baseDelay + jitter;
        console.log(`Retrying after ${Math.round(delayMs / 1000)}s due to model overload...`);
        await sleep(delayMs);
        continue;
      }

      // For non-503 errors or final attempt, return the error
      break;
    }
  }

  return {
    text: "",
    error: lastError?.message || "Unknown error occurred",
  };
}
