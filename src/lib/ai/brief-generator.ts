/**
 * Brief Generator for AI Content Generation
 *
 * Orchestrates AI content generation using brief templates and aggregated context.
 */

import { generateWithSystemInstruction } from "@/lib/ai/gemini";
import {
  AggregatedContext,
  formatContextForPrompt,
} from "@/lib/ai/context-aggregator";
import { BriefSection } from "@/types/brief";

export interface BriefGenerationInput {
  name: string;
  systemInstruction: string;
  outputFormat?: string | null;
  sections: BriefSection[];
}

export interface BriefGenerationResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Generates content using a brief template and aggregated context
 */
export async function generateBriefContent(
  brief: BriefGenerationInput,
  context: AggregatedContext
): Promise<BriefGenerationResult> {
  try {
    // Build the system instruction with brief context and reference examples
    const systemInstruction = buildSystemInstruction(brief, context);

    // Build the user prompt with context
    const prompt = buildPrompt(brief, context);

    // Call Gemini API
    const response = await generateWithSystemInstruction(
      prompt,
      systemInstruction,
      "gemini-3-pro-preview",
      3 // Max retries
    );

    if (response.error) {
      return {
        success: false,
        error: response.error,
      };
    }

    // Clean up the response (remove markdown code blocks if present)
    const content = cleanResponse(response.text);

    return {
      success: true,
      content,
    };
  } catch (error) {
    console.error("Brief generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Builds the system instruction for the AI model
 */
function buildSystemInstruction(
  brief: BriefGenerationInput,
  context: AggregatedContext
): string {
  const sectionGuide = brief.sections
    .map(
      (s, i) =>
        `${i + 1}. **${s.title}**${s.required ? " (Required)" : ""}${s.description ? `: ${s.description}` : ""}`
    )
    .join("\n");

  let instruction = `${brief.systemInstruction}

## Document Structure
Your output should include the following sections:
${sectionGuide}

## Output Guidelines
- Write in professional, clear language appropriate for sales documents
- Use specific details from the provided context whenever possible
- Be concise but thorough - every statement should add value
- Reference specific meetings, contacts, and data points to make the content authentic
- If information for a section is not available in the context, provide a reasonable placeholder or skip the section

## Markdown Formatting Requirements
You MUST use proper markdown syntax for all formatting:
- For bullet points, always start with a dash followed by a space: "- item text"
- For bold text within bullets: "- **Bold label**: description text"
- For headers, use # symbols: "# Header 1", "## Header 2", "### Header 3"
- For numbered lists: "1. First item", "2. Second item"
- Ensure there is a blank line before and after lists for proper parsing
- Example bullet list format:

- **First point**: Description of the first item
- **Second point**: Description of the second item
- **Third point**: Description of the third item
${brief.outputFormat ? `\n## Output Format\n${brief.outputFormat}` : ""}`;

  // Append reference examples if provided
  if (context.referenceDocuments && context.referenceDocuments.length > 0) {
    const examples = context.referenceDocuments
      .map((doc, i) => `### Example ${i + 1}: ${doc.title}\n\n${doc.content}`)
      .join("\n\n---\n\n");

    instruction += `

## Reference Examples
The following show the desired tone and structure:

${examples}

Adapt to each situation—do not copy these verbatim.`;
  }

  return instruction;
}

/**
 * Builds the user prompt with all context
 */
function buildPrompt(
  brief: BriefGenerationInput,
  context: AggregatedContext
): string {
  const formattedContext = formatContextForPrompt(context);

  return `Generate a "${brief.name}" document for the following opportunity.

# Context
${formattedContext}

# Instructions
Based on the context above, generate a comprehensive ${brief.name} document.
Focus on actionable, specific content that leverages the actual data and insights provided.
Make sure the document is ready for customer or internal use.`;
}

/**
 * Cleans up the AI response by removing markdown code blocks and extra whitespace
 */
function cleanResponse(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code blocks if the entire response is wrapped
  if (cleaned.startsWith("```markdown")) {
    cleaned = cleaned.slice("```markdown".length);
  } else if (cleaned.startsWith("```md")) {
    cleaned = cleaned.slice("```md".length);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

/**
 * Validates that the generated content contains expected sections
 */
export function validateGeneratedContent(
  content: string,
  sections: BriefSection[]
): { isValid: boolean; missingSections: string[] } {
  const requiredSections = sections.filter((s) => s.required);
  const missingSections: string[] = [];

  for (const section of requiredSections) {
    // Check if section title appears in content (case-insensitive)
    const titlePattern = new RegExp(section.title, "i");
    if (!titlePattern.test(content)) {
      missingSections.push(section.title);
    }
  }

  return {
    isValid: missingSections.length === 0,
    missingSections,
  };
}

// Backwards compatibility aliases
/** @deprecated Use BriefGenerationInput instead */
export type FrameworkGenerationInput = BriefGenerationInput;
/** @deprecated Use BriefGenerationResult instead */
export type FrameworkGenerationResult = BriefGenerationResult;
/** @deprecated Use generateBriefContent instead */
export const generateFrameworkContent = generateBriefContent;
