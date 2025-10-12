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
 * @param modelName - The model to use (default: gemini-1.5-flash)
 * @returns GenerativeModel instance
 */
export function getModel(modelName: string = "gemini-1.5-flash"): GenerativeModel {
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
 * @param modelName - Optional model name (default: gemini-1.5-flash)
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
 * Generate structured content with system instructions
 * @param prompt - The user prompt
 * @param systemInstruction - System-level instructions for the model
 * @param modelName - Optional model name (default: gemini-1.5-flash)
 * @returns Promise with the generated text or error
 */
export async function generateWithSystemInstruction(
  prompt: string,
  systemInstruction: string,
  modelName: string = "gemini-1.5-flash"
): Promise<GeminiResponse> {
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
    console.error("Gemini API error:", error);
    return {
      text: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
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
 * @param modelName - Optional model name (default: gemini-1.5-flash)
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
