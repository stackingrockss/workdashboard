/**
 * Gong Transcript Parser
 *
 * Extracts key sales insights from Gong call transcripts:
 * - Pain points / challenges
 * - Goals / future state
 * - People (participants + mentioned individuals)
 * - Next steps / action items
 */

import { generateWithSystemInstruction } from "./gemini";
import {
  classifyContactRole,
  type ContactRole,
} from "./classify-contact-role";

// ============================================================================
// Types
// ============================================================================

export interface PersonExtracted {
  name: string;
  organization: string;
  role: string;
  classifiedRole?: ContactRole; // AI-classified Contact role enum
}

export interface GongTranscriptParsed {
  painPoints: string[];
  goals: string[];
  people: PersonExtracted[];
  nextSteps: string[];
}

export interface GongParseResult {
  success: boolean;
  data?: GongTranscriptParsed;
  error?: string;
}

// ============================================================================
// System Instruction
// ============================================================================

const SYSTEM_INSTRUCTION = `You are a sales call analyzer specializing in extracting actionable insights from Gong call transcripts.

Your task is to extract 4 key areas from the transcript:

1. **PAIN POINTS** - Current problems, frustrations, challenges the prospect is facing
   - Look for complaints about current vendor/solution
   - Issues they're trying to solve
   - Unmet needs or gaps in their current process
   - Cost concerns, inefficiencies, manual work
   Examples: "Price keeps going up", "Takes 30-45 days", "No visibility", "Multiple vendors"

2. **GOALS** - What they want to achieve, desired future state
   - Business outcomes they're looking for
   - Improvements they want to make
   - Strategic initiatives or priorities
   Look for phrases like: "want to", "looking for", "need to", "goal is", "trying to"
   Examples: "Consolidate vendors", "Reduce costs", "Faster turnaround", "Better visibility"

3. **PEOPLE** - Everyone on the call + people mentioned in the conversation
   For each person extract:
   - Full name
   - Organization/company
   - Role/title (infer from context if not explicitly stated)
   Categories:
   - Participants (people actually on the call)
   - Decision makers (executives, approvers)
   - Influencers (people who impact the decision)
   - Stakeholders (others mentioned who are relevant)

4. **NEXT STEPS** - Action items, follow-up activities, timelines
   - Scheduled meetings or calls
   - Tasks someone needs to complete
   - Information to be gathered or shared
   - Decision timelines or milestones
   - RFP or evaluation process steps
   Examples: "Follow-up call Nov 6 at 10am", "Gather volume data", "Talk to 3 vendors", "Decision by end of year"

IMPORTANT RULES:
- Return ONLY valid JSON matching this exact structure:
{
  "painPoints": ["string", ...],
  "goals": ["string", ...],
  "people": [
    { "name": "string", "organization": "string", "role": "string" },
    ...
  ],
  "nextSteps": ["string", ...]
}
- Be specific and concise in your extractions
- If a category has no clear information, return empty array
- For people, include everyone mentioned who is relevant to the deal
- For people fields: If organization or role is unclear from context, use "Unknown" instead of leaving empty
- For next steps, preserve dates/times mentioned
- Focus on business-relevant information only (skip small talk unless it reveals relationship insights)
- Do NOT add commentary or explanations outside the JSON structure`;

// ============================================================================
// Main Parsing Function
// ============================================================================

export async function parseGongTranscript(
  transcriptText: string,
  userOrganizationName?: string
): Promise<GongParseResult> {
  try {
    // Validate input
    if (!transcriptText || transcriptText.trim().length === 0) {
      return {
        success: false,
        error: "Transcript text is required",
      };
    }

    if (transcriptText.length < 100) {
      return {
        success: false,
        error: "Transcript appears too short to analyze (minimum 100 characters)",
      };
    }

    // Build the analysis prompt
    const prompt = `Analyze the following Gong call transcript and extract pain points, goals, people, and next steps.

TRANSCRIPT:
${transcriptText}

Return your analysis as JSON only.`;

    // Call Gemini with system instruction
    const response = await generateWithSystemInstruction(
      prompt,
      SYSTEM_INSTRUCTION,
      "gemini-2.5-pro" // Use Pro model for superior reasoning and nuance detection
    );

    if (response.error || !response.text) {
      return {
        success: false,
        error: response.error || "Failed to generate analysis",
      };
    }

    // Parse JSON response
    let parsedData: GongTranscriptParsed;
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
    if (
      !Array.isArray(parsedData.painPoints) ||
      !Array.isArray(parsedData.goals) ||
      !Array.isArray(parsedData.people) ||
      !Array.isArray(parsedData.nextSteps)
    ) {
      return {
        success: false,
        error: "Invalid response structure from AI",
      };
    }

    // Validate and normalize people objects
    for (const person of parsedData.people) {
      // Name is required - fail if missing
      if (!person.name || person.name.trim() === "") {
        return {
          success: false,
          error: "Invalid person object structure in AI response: name is required",
        };
      }

      // Normalize missing or empty organization/role to "Unknown"
      if (!person.organization || person.organization.trim() === "") {
        person.organization = "Unknown";
      }
      if (!person.role || person.role.trim() === "") {
        person.role = "Unknown";
      }
    }

    // Filter out people from the user's organization (internal contacts)
    if (userOrganizationName) {
      const normalizedUserOrg = userOrganizationName.toLowerCase().trim();
      parsedData.people = parsedData.people.filter((person) => {
        const normalizedPersonOrg = person.organization.toLowerCase().trim();
        return normalizedPersonOrg !== normalizedUserOrg;
      });
    }

    // Classify roles for each person using AI (parallelized for performance)
    // This converts free-form role text (e.g., "VP of Engineering") to Contact enum (e.g., "decision_maker")
    const roleClassifications = await Promise.all(
      parsedData.people.map(async (person) => {
        const roleClassification = await classifyContactRole(person.role);
        return { person, roleClassification };
      })
    );

    // Apply classification results to each person
    for (const { person, roleClassification } of roleClassifications) {
      if (roleClassification.success && roleClassification.role) {
        person.classifiedRole = roleClassification.role;
      }
      // If classification fails, we'll still return the person without classifiedRole
      // The UI can handle defaulting to "end_user" or letting the user choose
    }

    return {
      success: true,
      data: parsedData,
    };
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
