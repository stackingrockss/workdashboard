/**
 * Gong Call Risk Analyzer
 *
 * Analyzes Gong call transcripts to identify deal risk signals across 6 categories:
 * - Budget: Pricing concerns, approval delays, competing priorities
 * - Timeline: Extended eval, postponed meetings, unclear urgency
 * - Competition: Alternative vendors, RFP process, feature comparisons
 * - Technical: Integration concerns, security blockers, resource constraints
 * - Alignment: Lack of executive sponsor, conflicting priorities, weak champion
 * - Resistance: Status quo satisfaction, "not the right time", low urgency
 */

import { generateWithSystemInstruction } from "./gemini";
import type {
  RiskAssessment,
  RiskLevel,
  RiskCategory,
  RiskSeverity,
} from "@/types/gong-call";

// ============================================================================
// Types
// ============================================================================

export interface RiskAnalysisResult {
  success: boolean;
  data?: RiskAssessment;
  error?: string;
}

// ============================================================================
// System Instruction
// ============================================================================

const SYSTEM_INSTRUCTION = `You are an enterprise sales risk analyst specializing in identifying deal risks from sales call transcripts.

Your task is to analyze the transcript and identify signals that may jeopardize deal closure across 6 risk categories:

**1. BUDGET RISK**
Signals to look for:
- Pricing objections or cost concerns
- "That's expensive" or comparison to cheaper alternatives
- Budget approval process delays or uncertainty
- Competing budget priorities
- ROI skepticism or unclear budget authority
- Mentions of "need to get approval" without clear timeline
Examples: "We have budget constraints", "Need to justify this to finance", "What's your best price?"

**2. TIMELINE RISK**
Signals to look for:
- Extended evaluation periods or delayed decisions
- Postponed or rescheduled meetings
- "We'll circle back" or "Let's reconnect in [future time]" without commitment
- Unclear next steps or vague timelines
- Mentions of "not urgent" or "no rush"
- Fiscal year or quarter boundaries pushing things out
Examples: "We're still evaluating", "Can we push this to next quarter?", "We need more time"

**3. COMPETITION RISK**
Signals to look for:
- Alternative vendors or solutions mentioned by name
- Active RFP or competitive evaluation process
- Feature comparisons with competitors
- "We're talking to other vendors"
- Incumbent relationship or existing solution satisfaction
- Mentions of "bake-off" or "proof of concept" with multiple vendors
Examples: "We're also looking at [Competitor]", "How do you compare to [Alternative]?", "We have 3 vendors in the running"

**4. TECHNICAL RISK**
Signals to look for:
- Integration complexity or compatibility concerns
- Security review blockers or compliance requirements
- IT resource constraints or bandwidth issues
- Technical requirements not met by solution
- Architecture or infrastructure concerns
- Need for customization or heavy services
Examples: "Our IT team is concerned about...", "Security review could take months", "Not sure this integrates with our stack"

**5. STAKEHOLDER ALIGNMENT RISK**
Signals to look for:
- Lack of executive sponsor or C-level involvement
- Multiple decision makers with conflicting priorities
- Weak or absent champion
- Blocker or skeptic actively involved
- Unclear decision-making process
- Diffused accountability ("we need to get everyone aligned")
Examples: "I'm not the final decision maker", "My boss isn't convinced yet", "Engineering wants X but product wants Y"

**6. CHANGE RESISTANCE RISK**
Signals to look for:
- Satisfaction with current solution or status quo
- "Not the right time" or "maybe next year"
- Low sense of urgency or pain
- Risk-averse culture or "if it ain't broke" mentality
- Recent change fatigue (just implemented something else)
- Fear of disruption or migration complexity
Examples: "Our current solution works okay", "We're not ready to change yet", "This would be a big lift for the team"

**OUTPUT FORMAT:**
Return ONLY valid JSON matching this exact structure:
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "riskFactors": [
    {
      "category": "budget" | "timeline" | "competition" | "technical" | "alignment" | "resistance",
      "description": "Brief description of the specific risk (1-2 sentences)",
      "severity": "low" | "medium" | "high",
      "evidence": "Direct quote or paraphrased context from transcript"
    }
  ],
  "overallSummary": "2-3 sentence summary of deal health and key concerns"
}

**RISK LEVEL GUIDELINES:**
- **low**: Deal is healthy, minor concerns that are manageable
- **medium**: Some concerning signals but not deal-breaking; requires attention
- **high**: Serious risks that could derail the deal; urgent action needed
- **critical**: Deal is in jeopardy; multiple severe risks; may be unwinnable

**SEVERITY GUIDELINES (per factor):**
- **low**: Minor concern, easy to address
- **medium**: Moderate concern, requires proactive management
- **high**: Major concern, could be a deal-breaker

**IMPORTANT RULES:**
- If no risks are detected, return riskLevel "low" with empty riskFactors array
- Focus on SIGNALS FROM THE TRANSCRIPT ONLY - don't infer risks not mentioned
- Evidence should be direct quotes when possible, or close paraphrasing
- Overall summary should be balanced (acknowledge both risks and positive signals)
- Do NOT add commentary outside the JSON structure
- Consider the COMBINATION of risks when setting overall riskLevel (multiple medium risks = high overall risk)`;

// ============================================================================
// Main Risk Analysis Function
// ============================================================================

/**
 * Analyzes a sales call transcript to identify deal risks across 6 categories
 *
 * This function uses AI (Gemini) to analyze sales call transcripts and extract:
 * - Risk level (low, medium, high, critical)
 * - Risk factors across 6 categories: budget, timeline, competition, technical, alignment, resistance
 * - Overall risk summary
 *
 * @param transcriptText - The full transcript text from the sales call (minimum 100 characters)
 * @returns Promise resolving to risk analysis result with success flag and data/error
 *
 * @example
 * ```typescript
 * const result = await analyzeCallRisk(transcriptText);
 * if (result.success && result.data) {
 *   console.log(`Risk Level: ${result.data.riskLevel}`);
 *   console.log(`Risk Factors: ${result.data.riskFactors.length}`);
 * } else {
 *   console.error('Risk analysis failed:', result.error);
 * }
 * ```
 *
 * @remarks
 * - Requires GEMINI_API_KEY environment variable
 * - Minimum transcript length: 100 characters
 * - Maximum transcript length: 80,000 characters (to stay within API limits)
 * - Never throws errors - returns error in result object instead
 * - Uses gemini-3-pro-preview model by default
 *
 * @see {@link RiskAnalysisResult} for return type
 * @see {@link RiskAssessment} for data structure
 */
export async function analyzeCallRisk(
  transcriptText: string
): Promise<RiskAnalysisResult> {
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
    const prompt = `Analyze the following sales call transcript and identify deal risks across the 6 categories (budget, timeline, competition, technical, alignment, resistance).

TRANSCRIPT:
${transcriptText}

Return your risk assessment as JSON only.`;

    // Call Gemini with system instruction
    const response = await generateWithSystemInstruction(
      prompt,
      SYSTEM_INSTRUCTION,
      "gemini-3-pro-preview" // Use Pro model for superior reasoning and nuance detection
    );

    if (response.error || !response.text) {
      return {
        success: false,
        error: response.error || "Failed to generate risk analysis",
      };
    }

    // Parse JSON response
    let parsedData: RiskAssessment;
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
    if (!parsedData.riskLevel) {
      return {
        success: false,
        error: "Invalid response structure: missing riskLevel",
      };
    }

    if (!Array.isArray(parsedData.riskFactors)) {
      return {
        success: false,
        error: "Invalid response structure: riskFactors must be an array",
      };
    }

    if (!parsedData.overallSummary || typeof parsedData.overallSummary !== "string") {
      return {
        success: false,
        error: "Invalid response structure: missing or invalid overallSummary",
      };
    }

    // Validate riskLevel enum
    const validRiskLevels: RiskLevel[] = ["low", "medium", "high", "critical"];
    if (!validRiskLevels.includes(parsedData.riskLevel)) {
      return {
        success: false,
        error: `Invalid riskLevel: ${parsedData.riskLevel}`,
      };
    }

    // Validate risk factors
    const validCategories: RiskCategory[] = [
      "budget",
      "timeline",
      "competition",
      "technical",
      "alignment",
      "resistance",
    ];
    const validSeverities: RiskSeverity[] = ["low", "medium", "high"];

    for (const factor of parsedData.riskFactors) {
      if (!validCategories.includes(factor.category)) {
        return {
          success: false,
          error: `Invalid risk category: ${factor.category}`,
        };
      }

      if (!validSeverities.includes(factor.severity)) {
        return {
          success: false,
          error: `Invalid risk severity: ${factor.severity}`,
        };
      }

      if (!factor.description || !factor.evidence) {
        return {
          success: false,
          error: "Risk factors must have description and evidence",
        };
      }
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
