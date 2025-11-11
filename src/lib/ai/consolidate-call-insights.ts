/**
 * Call Insights Consolidator
 *
 * Consolidates insights from multiple Gong calls into deduplicated summaries:
 * - Pain points (deduplicated and synthesized)
 * - Goals (deduplicated and synthesized)
 * - Risk assessment (aggregated across all calls)
 */

import { generateWithSystemInstruction } from "./gemini";
import type { RiskAssessment } from "@/types/gong-call";

// ============================================================================
// Types
// ============================================================================

export interface ConsolidatedInsights {
  painPoints: string[];
  goals: string[];
  riskAssessment: RiskAssessment;
}

export interface ConsolidationResult {
  success: boolean;
  data?: ConsolidatedInsights;
  error?: string;
}

// ============================================================================
// System Instruction
// ============================================================================

const SYSTEM_INSTRUCTION = `You are an expert sales analyst specializing in synthesizing insights from multiple sales call transcripts.

Your task is to consolidate pain points, goals, and risk assessments from multiple calls into concise, deduplicated summaries.

**CONSOLIDATION PRINCIPLES:**

1. **Deduplication**: Remove redundant or highly similar items
   - If multiple calls mention "pricing concerns" or "cost is high", consolidate into one item
   - If the same goal appears in multiple calls (e.g., "reduce vendor count"), keep only one version

2. **Synthesis**: Combine related items into clearer, more comprehensive statements
   - Merge similar pain points: "Manual process" + "Takes too long" → "Manual process causing delays"
   - Aggregate recurring themes while preserving specific details when important

3. **Prioritization**: Order by significance
   - Items mentioned in more calls should appear first
   - More severe or impactful items should be prioritized
   - Include frequency context when relevant (e.g., "mentioned in 3 of 5 calls")

4. **Clarity**: Make consolidated items more concise and actionable
   - Remove vague language and filler words
   - Use clear, direct statements
   - Preserve specific details (dates, numbers, names) when important

**OUTPUT FORMAT:**
Return ONLY valid JSON matching this exact structure:
{
  "painPoints": [
    "Consolidated pain point 1 (with frequency context if mentioned multiple times)",
    "Consolidated pain point 2",
    ...
  ],
  "goals": [
    "Consolidated goal 1 (with frequency context if mentioned multiple times)",
    "Consolidated goal 2",
    ...
  ],
  "riskAssessment": {
    "riskLevel": "low" | "medium" | "high" | "critical",
    "riskFactors": [
      {
        "category": "budget" | "timeline" | "competition" | "technical" | "alignment" | "resistance",
        "description": "Aggregated risk description across all calls",
        "severity": "low" | "medium" | "high",
        "evidence": "Combined evidence from multiple calls (cite call dates when possible)"
      }
    ],
    "overallSummary": "2-3 sentence summary of overall deal health across all calls",
    "recommendedActions": [
      "Prioritized action based on consolidated risks",
      ...
    ]
  }
}

**RISK CONSOLIDATION RULES:**
- Aggregate risk factors by category (e.g., combine all budget concerns into one factor)
- Escalate severity if the same risk appears multiple times or worsens over time
- Set overall riskLevel based on the most recent call's trends and cumulative concerns
- If a risk was mentioned in earlier calls but resolved in later calls, note the resolution in evidence
- Recommended actions should address the most critical consolidated risks first

**IMPORTANT RULES:**
- If all calls have empty painPoints, return empty painPoints array
- If all calls have empty goals, return empty goals array
- Focus on PATTERNS and THEMES across multiple calls
- Preserve temporal context (e.g., "Initially concerned about X, but later calls showed progress")
- Do NOT add commentary outside the JSON structure
- Be concise but comprehensive`;

// ============================================================================
// Main Consolidation Function
// ============================================================================

/**
 * Consolidates insights from multiple Gong calls
 * @param callInsights - Array of insights from individual calls with metadata
 * @returns Consolidated insights with deduplicated pain points, goals, and aggregated risk
 */
export async function consolidateCallInsights(
  callInsights: Array<{
    callId: string;
    meetingDate: string; // ISO date string
    painPoints: string[];
    goals: string[];
    riskAssessment: RiskAssessment | null;
  }>
): Promise<ConsolidationResult> {
  try {
    // Validate input
    if (!callInsights || callInsights.length === 0) {
      return {
        success: false,
        error: "At least one call insight is required",
      };
    }

    if (callInsights.length < 2) {
      return {
        success: false,
        error: "Consolidation requires at least 2 calls",
      };
    }

    // Sort calls by meeting date (oldest to newest) for temporal analysis
    const sortedCalls = [...callInsights].sort(
      (a, b) =>
        new Date(a.meetingDate).getTime() - new Date(b.meetingDate).getTime()
    );

    // Build the consolidation prompt with structured data
    const callsData = sortedCalls.map((call, index) => {
      const callDate = new Date(call.meetingDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      return `
### Call ${index + 1} (${callDate})

**Pain Points:**
${call.painPoints.length > 0 ? call.painPoints.map((p) => `- ${p}`).join("\n") : "- None identified"}

**Goals:**
${call.goals.length > 0 ? call.goals.map((g) => `- ${g}`).join("\n") : "- None identified"}

**Risk Assessment:**
${
  call.riskAssessment
    ? `- Risk Level: ${call.riskAssessment.riskLevel}
- Risk Factors: ${call.riskAssessment.riskFactors.length > 0 ? call.riskAssessment.riskFactors.map((rf) => `${rf.category} (${rf.severity}): ${rf.description}`).join("; ") : "None"}
- Summary: ${call.riskAssessment.overallSummary}`
    : "- Not available"
}
`;
    });

    const prompt = `Consolidate the following insights from ${sortedCalls.length} sales calls into a single deduplicated summary.

${callsData.join("\n")}

Return your consolidated analysis as JSON only.`;

    // Call Gemini with system instruction
    // Try gemini-2.5-pro first, fallback to gemini-2.5-flash if overloaded
    let response = await generateWithSystemInstruction(
      prompt,
      SYSTEM_INSTRUCTION,
      "gemini-2.5-pro", // Use Pro model for superior synthesis and reasoning
      3 // Max retries
    );

    // If gemini-2.5-pro fails with 503/overload, fallback to gemini-2.5-flash
    if (response.error && (response.error.includes("503") || response.error.includes("overloaded"))) {
      console.log("gemini-2.5-pro overloaded, falling back to gemini-2.5-flash...");
      response = await generateWithSystemInstruction(
        prompt,
        SYSTEM_INSTRUCTION,
        "gemini-2.5-flash", // Fallback to 2.5 Flash model
        3 // Max retries
      );
    }

    if (response.error || !response.text) {
      return {
        success: false,
        error: response.error || "Failed to generate consolidation",
      };
    }

    // Parse JSON response
    let parsedData: ConsolidatedInsights;
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
    if (!Array.isArray(parsedData.painPoints)) {
      return {
        success: false,
        error: "Invalid response structure: painPoints must be an array",
      };
    }

    if (!Array.isArray(parsedData.goals)) {
      return {
        success: false,
        error: "Invalid response structure: goals must be an array",
      };
    }

    if (!parsedData.riskAssessment) {
      return {
        success: false,
        error: "Invalid response structure: riskAssessment is required",
      };
    }

    // Validate risk assessment structure
    const riskAssessment = parsedData.riskAssessment;

    if (!riskAssessment.riskLevel) {
      return {
        success: false,
        error: "Invalid risk assessment: missing riskLevel",
      };
    }

    if (!Array.isArray(riskAssessment.riskFactors)) {
      return {
        success: false,
        error: "Invalid risk assessment: riskFactors must be an array",
      };
    }

    if (!Array.isArray(riskAssessment.recommendedActions)) {
      return {
        success: false,
        error: "Invalid risk assessment: recommendedActions must be an array",
      };
    }

    if (
      !riskAssessment.overallSummary ||
      typeof riskAssessment.overallSummary !== "string"
    ) {
      return {
        success: false,
        error: "Invalid risk assessment: missing or invalid overallSummary",
      };
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
