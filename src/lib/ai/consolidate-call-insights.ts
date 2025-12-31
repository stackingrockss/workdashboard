/**
 * Call Insights Consolidator
 *
 * Consolidates insights from multiple Gong calls into deduplicated summaries:
 * - Pain points (deduplicated and synthesized)
 * - Goals (deduplicated and synthesized)
 * - Risk assessment (aggregated across all calls)
 */

import { generateWithSystemInstruction } from "./gemini";
import type {
  RiskAssessment,
  CompetitionMention,
  DecisionProcess,
  CallSentiment,
  ConsolidatedCompetition,
  ConsolidatedDecisionProcess,
  ConsolidatedSentimentTrend,
} from "@/types/gong-call";

// ============================================================================
// Types
// ============================================================================

export interface ConsolidatedInsights {
  painPoints: string[];
  goals: string[];
  riskAssessment: RiskAssessment;
  whyAndWhyNow: string[];
  quantifiableMetrics: string[];
  // Enhanced consolidation fields
  keyQuotes: string[];
  objections: string[];
  competitionSummary: ConsolidatedCompetition;
  decisionProcessSummary: ConsolidatedDecisionProcess;
  sentimentTrend: ConsolidatedSentimentTrend;
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

Your task is to consolidate pain points, goals, risk assessments, business drivers, and quantifiable metrics from multiple calls into concise, deduplicated summaries.

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
    "overallSummary": "2-3 sentence summary of overall deal health across all calls"
  },
  "whyAndWhyNow": [
    "Consolidated business driver/urgency reason 1",
    "Consolidated business driver/urgency reason 2",
    ...
  ],
  "quantifiableMetrics": [
    "Consolidated ROI metric 1 (preserve exact numbers)",
    "Consolidated ROI metric 2",
    ...
  ],
  "keyQuotes": [
    "Best/most impactful customer quote 1",
    "Best/most impactful customer quote 2",
    ...
  ],
  "objections": [
    "Consolidated objection 1 (note if resolved)",
    "Consolidated objection 2",
    ...
  ],
  "competitionSummary": {
    "competitors": ["List of all competitors/alternatives mentioned"],
    "primaryThreat": "Most serious competitor or null if none stand out",
    "customerSentiment": "Overall summary of customer's view toward competition/alternatives"
  },
  "decisionProcessSummary": {
    "timeline": "Most recent/accurate timeline mentioned or null",
    "keyStakeholders": ["Consolidated list of decision makers/influencers"],
    "budgetStatus": "Latest budget context or null",
    "remainingSteps": ["What still needs to happen to close"]
  },
  "sentimentTrend": {
    "trajectory": "improving" | "stable" | "declining",
    "currentState": "positive" | "neutral" | "negative",
    "summary": "1-2 sentence narrative of how sentiment has evolved across calls"
  }
}

**RISK CONSOLIDATION RULES:**
- Aggregate risk factors by category (e.g., combine all budget concerns into one factor)
- Escalate severity if the same risk appears multiple times or worsens over time
- Set overall riskLevel based on the most recent call's trends and cumulative concerns
- If a risk was mentioned in earlier calls but resolved in later calls, note the resolution in evidence

**WHY AND WHY NOW CONSOLIDATION RULES:**
- Identify the primary business driver(s) triggering this evaluation
- Deduplicate similar urgency factors across calls
- Note any evolution in urgency over time (e.g., "Timeline moved up from Q2 to Q1")
- Order by significance - most compelling urgency factors first
- Preserve specific events, dates, or deadlines mentioned

**QUANTIFIABLE METRICS CONSOLIDATION RULES:**
- Deduplicate identical or near-identical metrics
- Preserve specific numbers exactly as mentioned (don't average or summarize numbers)
- Order by impact magnitude (largest savings/improvements first)
- Include frequency context if same metric mentioned multiple times
- Combine related metrics only if they're truly duplicates

**KEY QUOTES CONSOLIDATION RULES:**
- Select the most impactful, memorable quotes from across all calls
- Prioritize quotes that best capture pain, value proposition, or urgency
- Limit to 5-7 best quotes to keep it actionable
- Preserve exact wording when possible

**OBJECTIONS CONSOLIDATION RULES:**
- Deduplicate similar objections across calls
- Note if an objection from an earlier call was resolved in a later call
- Order by severity/impact on deal
- Combine related concerns into clearer statements

**COMPETITION CONSOLIDATION RULES:**
- List all unique competitors/alternatives mentioned
- Identify the primary threat based on frequency and customer sentiment
- Summarize overall competitive landscape from customer's perspective
- Include "status quo", "build in-house" if mentioned as alternatives

**DECISION PROCESS CONSOLIDATION RULES:**
- Use the most recent/accurate timeline information
- Consolidate all stakeholders mentioned across calls
- Use latest budget context (it may evolve)
- List remaining steps based on most recent call information

**SENTIMENT TREND RULES:**
- Compare sentiment across calls chronologically
- "improving" = later calls more positive than earlier ones
- "declining" = later calls more negative than earlier ones
- "stable" = consistent sentiment throughout
- Provide brief narrative of the evolution

**IMPORTANT RULES:**
- If all calls have empty painPoints, return empty painPoints array
- If all calls have empty goals, return empty goals array
- If all calls have empty whyAndWhyNow, return empty whyAndWhyNow array
- If all calls have empty quantifiableMetrics, return empty quantifiableMetrics array
- If all calls have empty keyQuotes, return empty keyQuotes array
- If all calls have empty objections, return empty objections array
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
    whyAndWhyNow: string[];
    quantifiableMetrics: string[];
    keyQuotes: string[];
    objections: string[];
    competitionMentions: CompetitionMention[];
    decisionProcess: DecisionProcess | null;
    callSentiment: CallSentiment | null;
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

**Why and Why Now:**
${call.whyAndWhyNow.length > 0 ? call.whyAndWhyNow.map((w) => `- ${w}`).join("\n") : "- None identified"}

**Quantifiable Metrics:**
${call.quantifiableMetrics.length > 0 ? call.quantifiableMetrics.map((m) => `- ${m}`).join("\n") : "- None identified"}

**Key Quotes:**
${call.keyQuotes.length > 0 ? call.keyQuotes.map((q) => `- "${q}"`).join("\n") : "- None captured"}

**Objections:**
${call.objections.length > 0 ? call.objections.map((o) => `- ${o}`).join("\n") : "- None raised"}

**Competition Mentions:**
${call.competitionMentions.length > 0 ? call.competitionMentions.map((c) => `- ${c.competitor} (${c.sentiment}): ${c.context}`).join("\n") : "- None mentioned"}

**Decision Process:**
${
  call.decisionProcess
    ? `- Timeline: ${call.decisionProcess.timeline || "Not specified"}
- Stakeholders: ${call.decisionProcess.stakeholders.length > 0 ? call.decisionProcess.stakeholders.join(", ") : "Not identified"}
- Budget: ${call.decisionProcess.budgetContext || "Not discussed"}
- Approval Steps: ${call.decisionProcess.approvalSteps.length > 0 ? call.decisionProcess.approvalSteps.join(", ") : "Not specified"}`
    : "- Not available"
}

**Call Sentiment:**
${
  call.callSentiment
    ? `- Overall: ${call.callSentiment.overall}, Momentum: ${call.callSentiment.momentum}, Enthusiasm: ${call.callSentiment.enthusiasm}`
    : "- Not assessed"
}

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
    const response = await generateWithSystemInstruction(
      prompt,
      SYSTEM_INSTRUCTION,
      "gemini-3-pro-preview", // Use Pro model for superior synthesis and reasoning
      3 // Max retries
    );

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

    // Normalize new fields (default to empty arrays if missing)
    if (!Array.isArray(parsedData.whyAndWhyNow)) {
      parsedData.whyAndWhyNow = [];
    }
    if (!Array.isArray(parsedData.quantifiableMetrics)) {
      parsedData.quantifiableMetrics = [];
    }
    if (!Array.isArray(parsedData.keyQuotes)) {
      parsedData.keyQuotes = [];
    }
    if (!Array.isArray(parsedData.objections)) {
      parsedData.objections = [];
    }

    // Normalize competitionSummary
    if (!parsedData.competitionSummary || typeof parsedData.competitionSummary !== "object") {
      parsedData.competitionSummary = {
        competitors: [],
        primaryThreat: null,
        customerSentiment: "No competition information available",
      };
    } else {
      if (!Array.isArray(parsedData.competitionSummary.competitors)) {
        parsedData.competitionSummary.competitors = [];
      }
      if (parsedData.competitionSummary.primaryThreat === undefined) {
        parsedData.competitionSummary.primaryThreat = null;
      }
      if (!parsedData.competitionSummary.customerSentiment) {
        parsedData.competitionSummary.customerSentiment = "No competition information available";
      }
    }

    // Normalize decisionProcessSummary
    if (!parsedData.decisionProcessSummary || typeof parsedData.decisionProcessSummary !== "object") {
      parsedData.decisionProcessSummary = {
        timeline: null,
        keyStakeholders: [],
        budgetStatus: null,
        remainingSteps: [],
      };
    } else {
      if (parsedData.decisionProcessSummary.timeline === undefined) {
        parsedData.decisionProcessSummary.timeline = null;
      }
      if (!Array.isArray(parsedData.decisionProcessSummary.keyStakeholders)) {
        parsedData.decisionProcessSummary.keyStakeholders = [];
      }
      if (parsedData.decisionProcessSummary.budgetStatus === undefined) {
        parsedData.decisionProcessSummary.budgetStatus = null;
      }
      if (!Array.isArray(parsedData.decisionProcessSummary.remainingSteps)) {
        parsedData.decisionProcessSummary.remainingSteps = [];
      }
    }

    // Normalize sentimentTrend
    if (!parsedData.sentimentTrend || typeof parsedData.sentimentTrend !== "object") {
      parsedData.sentimentTrend = {
        trajectory: "stable",
        currentState: "neutral",
        summary: "Insufficient data to assess sentiment trend",
      };
    } else {
      const validTrajectory = ["improving", "stable", "declining"];
      const validState = ["positive", "neutral", "negative"];

      if (!validTrajectory.includes(parsedData.sentimentTrend.trajectory)) {
        parsedData.sentimentTrend.trajectory = "stable";
      }
      if (!validState.includes(parsedData.sentimentTrend.currentState)) {
        parsedData.sentimentTrend.currentState = "neutral";
      }
      if (!parsedData.sentimentTrend.summary) {
        parsedData.sentimentTrend.summary = "Insufficient data to assess sentiment trend";
      }
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
