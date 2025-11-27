import { ContentType } from "@prisma/client";

/**
 * Content suggestion from AI
 * Can be from internal library or web search
 */
export interface ContentSuggestion {
  source: "internal" | "web";
  id?: string; // Only for internal content
  title: string;
  url: string;
  contentType: ContentType;
  description?: string;
  relevanceReason: string;
}

/**
 * Result from content suggestion generation
 */
export interface ContentSuggestionResult {
  suggestions: ContentSuggestion[];
  summary: string;
  webSearchUsed: boolean;
  error?: string;
}
