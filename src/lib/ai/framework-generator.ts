/**
 * Framework Generator for AI Content Generation
 *
 * Orchestrates AI content generation using framework templates and aggregated context.
 */

import { generateWithSystemInstruction } from "@/lib/ai/gemini";
import {
  AggregatedContext,
  formatContextForPrompt,
} from "@/lib/ai/context-aggregator";
import { FrameworkSection } from "@/types/framework";

export interface FrameworkGenerationInput {
  name: string;
  systemInstruction: string;
  outputFormat?: string | null;
  sections: FrameworkSection[];
}

export interface FrameworkGenerationResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Generates content using a framework template and aggregated context
 */
export async function generateFrameworkContent(
  framework: FrameworkGenerationInput,
  context: AggregatedContext
): Promise<FrameworkGenerationResult> {
  try {
    // Build the system instruction with framework context
    const systemInstruction = buildSystemInstruction(framework);

    // Build the user prompt with context
    const prompt = buildPrompt(framework, context);

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
    console.error("Framework generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Builds the system instruction for the AI model
 */
function buildSystemInstruction(framework: FrameworkGenerationInput): string {
  const sectionGuide = framework.sections
    .map(
      (s, i) =>
        `${i + 1}. **${s.title}**${s.required ? " (Required)" : ""}${s.description ? `: ${s.description}` : ""}`
    )
    .join("\n");

  return `${framework.systemInstruction}

## Document Structure
Your output should include the following sections:
${sectionGuide}

## Output Guidelines
- Write in professional, clear language appropriate for sales documents
- Use specific details from the provided context whenever possible
- Be concise but thorough - every statement should add value
- Use markdown formatting for structure (headers, bullet points, bold text)
- Reference specific meetings, contacts, and data points to make the content authentic
- If information for a section is not available in the context, provide a reasonable placeholder or skip the section
${framework.outputFormat ? `\n## Output Format\n${framework.outputFormat}` : ""}`;
}

/**
 * Builds the user prompt with all context
 */
function buildPrompt(
  framework: FrameworkGenerationInput,
  context: AggregatedContext
): string {
  const formattedContext = formatContextForPrompt(context);

  return `Generate a "${framework.name}" document for the following opportunity.

# Context
${formattedContext}

# Instructions
Based on the context above, generate a comprehensive ${framework.name} document.
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
  sections: FrameworkSection[]
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
