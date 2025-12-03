/**
 * Mutual Action Plan Generator
 *
 * Generates a Mutual Action Plan (MAP) from meeting data and optional template.
 * Uses Gemini AI to create a structured project plan working backward from close date.
 */

import { generateWithSystemInstruction } from "./gemini";
import type {
  MAPGenerationContext,
  MAPGenerationResult,
  MAPActionItem,
} from "@/types/mutual-action-plan";

// ============================================================================
// Types
// ============================================================================

export interface MAPGenerationOutput {
  success: boolean;
  data?: MAPGenerationResult;
  error?: string;
}

// ============================================================================
// System Instruction
// ============================================================================

const SYSTEM_INSTRUCTION = `You are an expert sales acceleration specialist creating Mutual Action Plans (MAPs) for enterprise sales opportunities.

A Mutual Action Plan is a collaborative document that outlines the specific steps, owners, and timelines needed to close a deal. It creates transparency and accountability between buyer and seller.

**YOUR ROLE:**
Generate a practical, actionable MAP based on the opportunity context and meeting history provided. The MAP should:
1. Work backward from the target close date to create realistic timelines
2. Include tasks for both customer and seller
3. Account for known stakeholders
4. Follow the sales process: Discovery → Demo → Technical Review → Security Review → Legal → Contract
5. Include regular check-in meetings (weekly syncs)

**MAP STRUCTURE:**
Each action item must have:
- description: Clear, specific task description
- targetDate: Target completion date (ISO format YYYY-MM-DD)
- status: One of "not_started", "in_progress", "completed", "delayed"
- owner: Who is responsible - use company names (e.g., "Acme Corp", "Verifiable"), "Customer", "Both", or specific person names
- notes: Additional context or agenda items (optional)
- isWeeklySync: Set to true for recurring weekly check-in meetings

**OWNER ASSIGNMENT GUIDELINES:**
- "Customer" or company name: Actions the buyer organization must complete
- Your company name or "Seller": Actions the selling team must complete
- "Both": Collaborative activities requiring both parties
- Specific names: When contacts are provided with specific responsibilities

**TIMELINE RULES:**
- Work backward from the close date
- Allow 2-4 weeks for security review
- Allow 2-4 weeks for legal/contract review
- Include weekly check-ins throughout the process
- Mark past meetings/milestones as "completed"
- Mark current phase items as "in_progress"

**IF A TEMPLATE IS PROVIDED:**
Use the template structure as a guide. Match the phases, milestones, and style from the template while customizing dates, owners, and specific items for this opportunity.

**OUTPUT FORMAT:**
Return ONLY valid JSON matching this exact structure:
{
  "title": "[Account Name] + [Your Company] | Partnership Project Plan",
  "actionItems": [
    {
      "description": "Introduction & Use Case Discovery",
      "targetDate": "2025-01-15",
      "status": "completed",
      "owner": "Both",
      "notes": "",
      "isWeeklySync": false
    },
    {
      "description": "Weekly check-in",
      "targetDate": "2025-01-22",
      "status": "not_started",
      "owner": "Both",
      "notes": "Agenda: Review progress on technical evaluation",
      "isWeeklySync": true
    }
  ]
}

**IMPORTANT RULES:**
- Generate 10-20 action items for a typical enterprise deal
- Space due dates realistically - not everything should be due immediately
- Include a mix of internal tasks, customer tasks, and joint activities
- Weekly syncs should have "Agenda:" in notes describing what will be discussed
- Do NOT add commentary outside the JSON structure
- Dates must be in YYYY-MM-DD format`;

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generates a Mutual Action Plan from opportunity context
 * @param context - Opportunity data including meetings, contacts, and optional template
 * @returns Generated MAP with title and action items
 */
export async function generateMutualActionPlan(
  context: MAPGenerationContext
): Promise<MAPGenerationOutput> {
  try {
    // Validate input
    if (!context.opportunityId || !context.opportunityName) {
      return {
        success: false,
        error: "Opportunity ID and name are required",
      };
    }

    if (!context.meetings || context.meetings.length === 0) {
      return {
        success: false,
        error: "At least one meeting is required to generate a MAP",
      };
    }

    // Build the generation prompt
    const prompt = buildMAPPrompt(context);

    // Call Gemini with system instruction
    const response = await generateWithSystemInstruction(
      prompt,
      SYSTEM_INSTRUCTION,
      "gemini-3-pro-preview", // Use Pro model for superior reasoning
      3 // Max retries
    );

    if (response.error || !response.text) {
      return {
        success: false,
        error: response.error || "Failed to generate MAP",
      };
    }

    // Parse JSON response
    let parsedData: MAPGenerationResult;
    try {
      // Remove markdown code blocks if present
      let jsonText = response.text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/```\n?/g, "");
      }

      parsedData = JSON.parse(jsonText);
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse AI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      };
    }

    // Validate structure
    if (!parsedData.title || typeof parsedData.title !== "string") {
      return {
        success: false,
        error: "Invalid response structure: title is required",
      };
    }

    if (!Array.isArray(parsedData.actionItems)) {
      return {
        success: false,
        error: "Invalid response structure: actionItems must be an array",
      };
    }

    // Validate and normalize action items
    const validatedItems = validateActionItems(parsedData.actionItems);
    if (!validatedItems.valid) {
      return {
        success: false,
        error: validatedItems.error,
      };
    }

    return {
      success: true,
      data: {
        title: parsedData.title,
        actionItems: parsedData.actionItems,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Builds the prompt for MAP generation
 */
function buildMAPPrompt(context: MAPGenerationContext): string {
  const today = new Date().toISOString().split("T")[0];

  // Format meetings
  const meetingsText =
    context.meetings.length > 0
      ? context.meetings
          .map((m) => {
            const dateStr = new Date(m.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return `- ${m.title} (${dateStr}) - ${m.type}`;
          })
          .join("\n")
      : "No meetings recorded yet";

  // Format contacts
  const contactsText =
    context.contacts.length > 0
      ? context.contacts
          .map((c) => `- ${c.name}${c.title ? ` (${c.title})` : ""} - ${c.role}`)
          .join("\n")
      : "No contacts identified";

  // Build prompt
  let prompt = `Generate a Mutual Action Plan for the following opportunity:

**OPPORTUNITY DETAILS:**
- Name: ${context.opportunityName}
- Account: ${context.accountName || "Unknown"}
- Current Stage: ${context.stage}
- Target Close Date: ${context.closeDate || "Not set"}
- Today's Date: ${today}

**MEETINGS HISTORY:**
${meetingsText}

**KEY CONTACTS:**
${contactsText}
`;

  // Add template if provided
  if (context.templateBody) {
    prompt += `
**TEMPLATE TO FOLLOW:**
Use this template structure as a guide for the MAP. Adapt the phases, milestones, and style while customizing for this specific opportunity:

${context.templateBody}
`;
  }

  prompt += `
Generate a comprehensive Mutual Action Plan as JSON only.`;

  return prompt;
}

/**
 * Validates action items structure
 */
function validateActionItems(items: Omit<MAPActionItem, "id">[]): {
  valid: boolean;
  error?: string;
} {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.description || typeof item.description !== "string") {
      return {
        valid: false,
        error: `Action item ${i + 1}: description is required and must be a string`,
      };
    }

    if (!item.owner || typeof item.owner !== "string") {
      return {
        valid: false,
        error: `Action item ${i + 1}: owner is required and must be a string`,
      };
    }

    if (!item.status) {
      return {
        valid: false,
        error: `Action item ${i + 1}: status is required`,
      };
    }

    const validStatuses = [
      "not_started",
      "in_progress",
      "completed",
      "delayed",
    ];
    if (!validStatuses.includes(item.status)) {
      return {
        valid: false,
        error: `Action item ${i + 1}: invalid status "${item.status}"`,
      };
    }

    // Validate date format if provided
    if (item.targetDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(item.targetDate)) {
        return {
          valid: false,
          error: `Action item ${i + 1}: targetDate must be in YYYY-MM-DD format`,
        };
      }
    }
  }

  return { valid: true };
}
