/**
 * Gong Transcript Parser
 *
 * Extracts key sales insights from Gong call transcripts:
 * - Pain points / challenges
 * - Goals / future state
 * - People (participants + mentioned individuals)
 * - Next steps / action items
 * - Key quotes / verbatim statements
 * - Objections / concerns raised
 * - Competition mentions
 * - Decision process details
 * - Call sentiment
 */

import { generateWithSystemInstruction } from "./gemini";
import {
  classifyContactRole,
  type ContactRole,
} from "./classify-contact-role";
import type {
  CompetitionMention,
  DecisionProcess,
  CallSentiment,
} from "@/lib/validations/gong-call";

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
  whyAndWhyNow: string[];
  quantifiableMetrics: string[];
  // Enhanced extraction fields
  keyQuotes: string[];
  objections: string[];
  competitionMentions: CompetitionMention[];
  decisionProcess: DecisionProcess;
  callSentiment: CallSentiment;
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

Your task is to extract 11 key areas from the transcript:

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

5. **WHY AND WHY NOW?** - Business drivers and urgency behind this evaluation
   - What is triggering this evaluation NOW vs 6 months ago?
   - What business event or change is driving this initiative?
   - What happens if they don't act? What's the cost of inaction?
   - Look for: new leadership, competitive pressure, contract renewals, growth initiatives, cost pressures, regulatory changes, digital transformation, company events
   Examples: "CEO mandated vendor consolidation", "Current contract expires in Q1", "Competitor just launched similar capability", "New CFO wants cost visibility", "Board pressure to modernize"
   Return as a list of distinct reasons/drivers.

6. **QUANTIFIABLE METRICS** - Specific numbers and measurable ROI outcomes mentioned
   - Cost savings or revenue impact (dollar amounts, percentages)
   - Time savings (hours, days, weeks, FTEs)
   - Efficiency improvements (% reduction, volume increases)
   - Business KPIs mentioned (retention, NPS, conversion rates)
   - Scale/volume metrics (users, transactions, customers)
   - Only include metrics with actual numbers or percentages
   Examples: "$2M in annual savings expected", "30% faster processing time", "Reduce headcount by 4 FTEs", "Handle 10x more transaction volume", "Currently spending $500K/year"

7. **KEY QUOTES** - Verbatim customer statements that capture pain, value, or important context
   - Direct quotes that could be used in proposals or case studies
   - Statements that reveal true priorities or concerns
   - Memorable phrases that capture the essence of their situation
   - Include speaker attribution if clear (e.g., "John: 'We need this done by Q1'")
   Examples: "We're spending $2M a year on this manual process", "If we don't solve this by Q1, heads will roll", "Our CEO is personally invested in this initiative"

8. **OBJECTIONS** - Concerns, pushback, or hesitations raised by the prospect
   - Pricing concerns (too expensive, budget constraints, ROI questions)
   - Timing concerns (not the right time, other priorities, resource constraints)
   - Technical concerns (integration complexity, security, scalability)
   - Process concerns (too complex, change management, training)
   - Competitive concerns (considering alternatives, incumbent relationship)
   - Status quo concerns (current solution is "good enough", risk of change)
   Examples: "We're not sure we can justify the cost", "Our IT team is stretched thin", "We've been burned by vendors before", "The board wants us to wait until next fiscal year"

9. **COMPETITION MENTIONS** - Any mention of competitors or alternative solutions
   For each mention extract:
   - competitor: Named vendor OR alternatives like "status quo", "manual process", "do nothing", "build in-house", "current vendor"
   - context: What was said about them
   - sentiment: "positive", "negative", or "neutral" (from customer's perspective toward the competitor)
   Examples:
   - {"competitor": "Acme Corp", "context": "We're also talking to them but their pricing is confusing", "sentiment": "negative"}
   - {"competitor": "status quo", "context": "Our current process works but it's slow and error-prone", "sentiment": "negative"}
   - {"competitor": "build in-house", "context": "Engineering wants to build this themselves", "sentiment": "positive"}

10. **DECISION PROCESS** - Information about how and when they'll make a decision
    Extract:
    - timeline: When they need to decide or go live (e.g., "Q1 2025", "by end of year", "within 90 days"). Use null if not mentioned.
    - stakeholders: Array of people/roles who will be involved in the decision (e.g., ["CFO", "VP Engineering", "Legal"])
    - budgetContext: Budget status, range mentioned, or approval situation as a simple string (e.g., "Budget approved for $200K", "Waiting on Q1 budget cycle", "Need to get CFO approval"). Use null if not mentioned.
    - approvalSteps: Array of steps needed to get to yes (e.g., ["Security review", "Legal sign-off", "Board approval", "Pilot program"])

11. **CALL SENTIMENT** - Overall tone and trajectory of the conversation
    Extract:
    - overall: "positive", "neutral", or "negative" - How did the call feel overall?
    - momentum: "accelerating", "steady", or "stalling" - Is the deal moving forward, maintaining pace, or slowing down?
    - enthusiasm: "high", "medium", or "low" - How engaged and interested was the prospect?

IMPORTANT RULES:
- Return ONLY valid JSON matching this exact structure:
{
  "painPoints": ["string", ...],
  "goals": ["string", ...],
  "people": [
    { "name": "string", "organization": "string", "role": "string" },
    ...
  ],
  "nextSteps": ["string", ...],
  "whyAndWhyNow": ["string", ...],
  "quantifiableMetrics": ["string", ...],
  "keyQuotes": ["string", ...],
  "objections": ["string", ...],
  "competitionMentions": [
    { "competitor": "string", "context": "string", "sentiment": "positive|negative|neutral" },
    ...
  ],
  "decisionProcess": {
    "timeline": "string or null",
    "stakeholders": ["string", ...],
    "budgetContext": "string or null",
    "approvalSteps": ["string", ...]
  },
  "callSentiment": {
    "overall": "positive|neutral|negative",
    "momentum": "accelerating|steady|stalling",
    "enthusiasm": "high|medium|low"
  }
}
- Be specific and concise in your extractions
- If a category has no clear information, return empty array (or null for optional string fields)
- For people, include everyone mentioned who is relevant to the deal
- For people fields: If organization or role is unclear from context, use "Unknown" instead of leaving empty
- For next steps, preserve dates/times mentioned
- For quantifiableMetrics, only include items with actual numbers or percentages mentioned
- For keyQuotes, use the customer's actual words as closely as possible
- For objections, be specific about the nature of the concern
- For competitionMentions, include "status quo" and "build in-house" as valid competitors
- For decisionProcess, capture the buying process details even if incomplete
- For callSentiment, assess based on overall tone, engagement level, and deal momentum signals
- Focus on business-relevant information only (skip small talk unless it reveals relationship insights)
- Do NOT add commentary or explanations outside the JSON structure`;

// ============================================================================
// Main Parsing Function
// ============================================================================

/**
 * Parses a Gong call transcript to extract actionable sales insights
 *
 * This function uses AI (Gemini) to analyze sales call transcripts and extract:
 * - Pain points: Current problems, frustrations, and challenges the prospect is facing
 * - Goals: Desired future state, business outcomes, and strategic initiatives
 * - People: Participants and mentioned individuals with their roles
 * - Next steps: Action items, follow-ups, and commitments made
 *
 * @param transcriptText - The full transcript text from the Gong call (minimum 100 characters)
 * @param userOrganizationName - Optional organization name to differentiate internal vs external people
 * @returns Promise resolving to parse result with success flag and data/error
 *
 * @example
 * ```typescript
 * const result = await parseGongTranscript(transcriptText, "Acme Corp");
 * if (result.success && result.data) {
 *   console.log(`Pain Points: ${result.data.painPoints.length}`);
 *   console.log(`Goals: ${result.data.goals.length}`);
 *   console.log(`People: ${result.data.people.length}`);
 *   console.log(`Next Steps: ${result.data.nextSteps.length}`);
 * } else {
 *   console.error('Parsing failed:', result.error);
 * }
 * ```
 *
 * @remarks
 * - Requires GEMINI_API_KEY environment variable
 * - Minimum transcript length: 100 characters
 * - Maximum transcript length: 80,000 characters (to stay within API limits)
 * - Never throws errors - returns error in result object instead
 * - Uses gemini-3-pro-preview model for superior reasoning and nuance detection
 * - Automatically classifies contact roles using AI after extraction
 *
 * @see {@link GongParseResult} for return type
 * @see {@link GongTranscriptParsed} for data structure
 * @see {@link PersonExtracted} for people data structure
 */
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
      "gemini-3-pro-preview" // Use Pro model for superior reasoning and nuance detection
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

    // Normalize new fields (default to empty arrays if missing)
    if (!Array.isArray(parsedData.whyAndWhyNow)) {
      parsedData.whyAndWhyNow = [];
    }
    if (!Array.isArray(parsedData.quantifiableMetrics)) {
      parsedData.quantifiableMetrics = [];
    }

    // Normalize enhanced extraction fields
    if (!Array.isArray(parsedData.keyQuotes)) {
      parsedData.keyQuotes = [];
    }
    if (!Array.isArray(parsedData.objections)) {
      parsedData.objections = [];
    }
    if (!Array.isArray(parsedData.competitionMentions)) {
      parsedData.competitionMentions = [];
    }

    // Normalize decisionProcess
    if (!parsedData.decisionProcess || typeof parsedData.decisionProcess !== "object") {
      parsedData.decisionProcess = {
        timeline: null,
        stakeholders: [],
        budgetContext: null,
        approvalSteps: [],
      };
    } else {
      // Ensure all fields exist
      if (parsedData.decisionProcess.timeline === undefined) {
        parsedData.decisionProcess.timeline = null;
      }
      if (!Array.isArray(parsedData.decisionProcess.stakeholders)) {
        parsedData.decisionProcess.stakeholders = [];
      }
      if (parsedData.decisionProcess.budgetContext === undefined) {
        parsedData.decisionProcess.budgetContext = null;
      }
      if (!Array.isArray(parsedData.decisionProcess.approvalSteps)) {
        parsedData.decisionProcess.approvalSteps = [];
      }
    }

    // Normalize callSentiment
    if (!parsedData.callSentiment || typeof parsedData.callSentiment !== "object") {
      parsedData.callSentiment = {
        overall: "neutral",
        momentum: "steady",
        enthusiasm: "medium",
      };
    } else {
      // Validate enum values with defaults
      const validOverall = ["positive", "neutral", "negative"];
      const validMomentum = ["accelerating", "steady", "stalling"];
      const validEnthusiasm = ["high", "medium", "low"];

      if (!validOverall.includes(parsedData.callSentiment.overall)) {
        parsedData.callSentiment.overall = "neutral";
      }
      if (!validMomentum.includes(parsedData.callSentiment.momentum)) {
        parsedData.callSentiment.momentum = "steady";
      }
      if (!validEnthusiasm.includes(parsedData.callSentiment.enthusiasm)) {
        parsedData.callSentiment.enthusiasm = "medium";
      }
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
