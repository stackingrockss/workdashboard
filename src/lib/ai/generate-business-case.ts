import { generateWithSystemInstruction } from "./gemini";

/**
 * Context for generating a business case
 */
export interface BusinessCaseContext {
  opportunity: {
    name: string;
    amountArr: number;
    stage: string;
    confidenceLevel: number;
    competition?: string | null;
    platformType?: string | null;
    consolidatedPainPoints?: string[] | null;
    consolidatedGoals?: string[] | null;
    accountResearch?: string | null;
  };
  account?: {
    name: string;
    industry?: string | null;
    website?: string | null;
  } | null;
  contacts: Array<{
    firstName: string;
    lastName: string;
    title?: string | null;
    role: string;
    sentiment: string;
  }>;
  priorBusinessCases: Array<{
    title: string;
    body: string;
  }>;
}

/**
 * Response from business case generation
 */
export interface BusinessCaseResponse {
  success: boolean;
  businessCase?: string;
  questions?: string;
  error?: string;
}

/**
 * System instruction for business case generation
 * Note: No hardcoded product details - AI learns from prior business case examples
 */
const BUSINESS_CASE_SYSTEM_INSTRUCTION = `You are a sales document specialist who creates compelling business cases for enterprise software deals.

Your task is to generate TWO separate outputs based on:
1. Prior business case examples (learn the style, structure, and product details from these)
2. Customer-specific context (pain points, goals, stakeholders)

## OUTPUT FORMAT

You MUST return your response in the following exact format with these exact separators:

===BUSINESS_CASE_START===
[Your business case content here in markdown]
===BUSINESS_CASE_END===

===QUESTIONS_START===
[Your discovery questions here in markdown]
===QUESTIONS_END===

## BUSINESS CASE REQUIREMENTS

Create a comprehensive business case draft with these sections:

### Format:
- Clean markdown suitable for Google Slides conversion
- Use ## for section headers
- Use bullet points (-) for lists
- Use **bold** sparingly for key numbers only
- Keep each section concise (3-5 bullets max)
- Total length: 800-1200 words

### Sections to Include:
1. Executive Summary (3-4 sentences, key value proposition, expected ROI)
2. Current State & Challenges (quantify impact where possible)
3. Proposed Solution (map to customer pain points)
4. Expected Business Outcomes (efficiency gains, cost savings, time to value)
5. ROI Analysis (include a markdown table with metrics)
6. Implementation Roadmap (phases with milestones)
7. Next Steps (concrete action items)

## DISCOVERY QUESTIONS REQUIREMENTS

Generate questions to help the sales rep gather ROI data and quantify pain points.

### Question Categories:
- **Quantifying Current Pain**: How long does X take? How many FTEs? What's the error rate?
- **Financial Impact**: What's the cost of the current process? Cost of errors/delays?
- **Time & Efficiency**: Hours spent per week/month on manual tasks?
- **Risk & Compliance**: Cost of audit failures? Compliance penalties?

### Format for Questions:
- Group by category with ## headers
- 3-5 questions per category
- Include brief context for why each question matters
- Make questions specific to the customer's documented pain points

## IMPORTANT GUIDELINES

1. Learn product details, value props, and tone from the prior business case examples
2. If no prior examples are provided, create a generic structure focused on the customer's pain points
3. Tailor all content to the specific customer's pain points and goals
4. Questions should help fill gaps in the ROI story
5. Be specific and actionable - avoid generic statements
6. Reference the customer's industry and stakeholders where relevant`;

/**
 * Build the prompt for business case generation
 */
function buildBusinessCasePrompt(context: BusinessCaseContext): string {
  const { opportunity, account, contacts, priorBusinessCases } = context;

  // Format pain points
  const painPointsText =
    opportunity.consolidatedPainPoints && opportunity.consolidatedPainPoints.length > 0
      ? opportunity.consolidatedPainPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "No pain points documented yet.";

  // Format goals
  const goalsText =
    opportunity.consolidatedGoals && opportunity.consolidatedGoals.length > 0
      ? opportunity.consolidatedGoals.map((g, i) => `${i + 1}. ${g}`).join("\n")
      : "No goals documented yet.";

  // Format contacts by role
  const decisionMakers = contacts.filter((c) => c.role === "decision_maker");
  const champions = contacts.filter((c) => c.role === "champion");
  const influencers = contacts.filter((c) => c.role === "influencer");

  const formatContactList = (list: typeof contacts) =>
    list.length > 0
      ? list.map((c) => `- ${c.firstName} ${c.lastName} (${c.title || "No title"}) - ${c.sentiment}`).join("\n")
      : "- Not identified yet";

  // Format prior business cases (truncate each to ~4000 chars)
  const priorCasesText =
    priorBusinessCases.length > 0
      ? priorBusinessCases
          .map((bc, i) => {
            const truncatedBody = bc.body.length > 4000
              ? bc.body.substring(0, 4000) + "\n\n... (truncated)"
              : bc.body;
            return `### Example ${i + 1}: ${bc.title}\n\n${truncatedBody}`;
          })
          .join("\n\n---\n\n")
      : "";

  // Format account research (truncate to 3000 chars)
  const accountResearchText = opportunity.accountResearch
    ? opportunity.accountResearch.length > 3000
      ? opportunity.accountResearch.substring(0, 3000) + "\n\n... (truncated)"
      : opportunity.accountResearch
    : "";

  // Format stage for display
  const stageLabels: Record<string, string> = {
    discovery: "Discovery",
    demo: "Demo",
    validateSolution: "Validate Solution",
    decisionMakerApproval: "Decision Maker Approval",
    contracting: "Contracting",
    closedWon: "Closed Won",
    closedLost: "Closed Lost",
  };

  return `Generate a business case and discovery questions for the following opportunity.

## Opportunity Overview

**Opportunity Name:** ${opportunity.name}
**Account:** ${account?.name || "Unknown"}
**Industry:** ${account?.industry || "Not specified"}
**Website:** ${account?.website || "Not provided"}
**Deal Size:** $${opportunity.amountArr.toLocaleString()} ARR
**Stage:** ${stageLabels[opportunity.stage] || opportunity.stage}
**Confidence Level:** ${opportunity.confidenceLevel}/5
${opportunity.platformType ? `**Platform Type:** ${opportunity.platformType.toUpperCase()}` : ""}
${opportunity.competition ? `**Competition:** ${opportunity.competition}` : ""}

## Customer Pain Points (from Sales Conversations)

${painPointsText}

## Customer Goals (from Sales Conversations)

${goalsText}

## Key Stakeholders

**Decision Makers:**
${formatContactList(decisionMakers)}

**Champions:**
${formatContactList(champions)}

**Influencers:**
${formatContactList(influencers)}

${accountResearchText ? `## Account Research\n\n${accountResearchText}` : ""}

${priorCasesText ? `## Prior Business Case Examples (for style/structure reference)\n\n${priorCasesText}\n\n**IMPORTANT:** Use these examples to learn the style, structure, and product details. DO NOT copy content directly - create original content tailored to this specific opportunity.` : "## Note\n\nNo prior business case examples are available. Generate a generic business case structure that the user can customize with their product details."}

---

Generate the business case and discovery questions now, following the exact output format specified in your instructions.`;
}

/**
 * Parse the AI response to extract business case and questions
 */
function parseResponse(text: string): { businessCase: string; questions: string } {
  // Extract business case
  const businessCaseMatch = text.match(/===BUSINESS_CASE_START===\s*([\s\S]*?)\s*===BUSINESS_CASE_END===/);
  const businessCase = businessCaseMatch ? businessCaseMatch[1].trim() : "";

  // Extract questions
  const questionsMatch = text.match(/===QUESTIONS_START===\s*([\s\S]*?)\s*===QUESTIONS_END===/);
  const questions = questionsMatch ? questionsMatch[1].trim() : "";

  // If parsing fails, try to split on a common pattern
  if (!businessCase && !questions) {
    // Fallback: look for "Discovery Questions" or "Business Case Questions" as separator
    const questionsSeparatorIndex = text.search(/##\s*(Discovery Questions|Business Case Questions)/i);
    if (questionsSeparatorIndex > 0) {
      return {
        businessCase: text.substring(0, questionsSeparatorIndex).trim(),
        questions: text.substring(questionsSeparatorIndex).trim(),
      };
    }
    // If no separator found, return the whole text as business case
    return { businessCase: text.trim(), questions: "" };
  }

  return { businessCase, questions };
}

/**
 * Generate a business case using Gemini
 */
export async function generateBusinessCase(
  context: BusinessCaseContext
): Promise<BusinessCaseResponse> {
  try {
    const prompt = buildBusinessCasePrompt(context);

    const result = await generateWithSystemInstruction(
      prompt,
      BUSINESS_CASE_SYSTEM_INSTRUCTION,
      "gemini-3-pro-preview",
      3 // Standard 3 retries
    );

    if (result.error) {
      return {
        success: false,
        error: result.error,
      };
    }

    const { businessCase, questions } = parseResponse(result.text);

    if (!businessCase) {
      return {
        success: false,
        error: "Failed to generate business case content",
      };
    }

    return {
      success: true,
      businessCase,
      questions: questions || undefined,
    };
  } catch (error) {
    console.error("Error generating business case:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
