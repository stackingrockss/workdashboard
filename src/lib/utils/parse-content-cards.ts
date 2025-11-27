import { ContentSuggestion } from "@/lib/ai/content-suggestion";

/**
 * Parsed segment from chat message content
 */
export interface ParsedSegment {
  type: "text" | "card";
  content: string | ContentSuggestion;
}

/**
 * Parse content with embedded [CONTENT_CARD] markers
 * Returns array of segments (text or card)
 * Handles incomplete blocks during streaming gracefully
 *
 * @param content - Content string with embedded card markers
 * @returns Array of parsed segments
 */
export function parseContentCards(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const regex = /\[CONTENT_CARD\](.*?)\[\/CONTENT_CARD\]/gs;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Add text before this card (if any)
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        segments.push({ type: "text", content: textContent });
      }
    }

    // Parse the card JSON
    try {
      const jsonStr = match[1].trim();
      const parsed: ContentSuggestion = JSON.parse(jsonStr);

      // Validate required fields
      if (parsed.source && parsed.title && parsed.url && parsed.contentType) {
        segments.push({ type: "card", content: parsed });
      } else {
        // Invalid card, treat as text
        segments.push({ type: "text", content: match[0] });
      }
    } catch (error) {
      // Malformed JSON, treat as text
      console.warn("[parseContentCards] Failed to parse card JSON:", match[1]);
      segments.push({ type: "text", content: match[0] });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last card
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex).trim();

    // Check if remaining text contains an incomplete card marker
    // This handles streaming where we might have received "[CONTENT_CARD]" without the closing tag
    const hasIncompleteOpenTag =
      remainingText.includes("[CONTENT_CARD]") && !remainingText.includes("[/CONTENT_CARD]");

    if (hasIncompleteOpenTag) {
      // During streaming, treat incomplete card as text for now
      // It will be properly parsed once the full card arrives
      if (remainingText) {
        segments.push({ type: "text", content: remainingText });
      }
    } else {
      // Normal remaining text
      if (remainingText) {
        segments.push({ type: "text", content: remainingText });
      }
    }
  }

  return segments;
}

/**
 * Check if content appears to have incomplete card markers
 * Useful for determining if streaming is still in progress
 *
 * @param content - Content to check
 * @returns True if there are unclosed card markers
 */
export function hasIncompleteCards(content: string): boolean {
  const openTags = (content.match(/\[CONTENT_CARD\]/g) || []).length;
  const closeTags = (content.match(/\[\/CONTENT_CARD\]/g) || []).length;
  return openTags > closeTags;
}
