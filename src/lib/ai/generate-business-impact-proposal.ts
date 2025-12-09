import { generateWithSystemInstruction } from "./gemini";

/**
 * Context for generating a Business Impact Proposal
 */
export interface BusinessImpactProposalContext {
  opportunity: {
    name: string;
    amountArr: number;
    stage: string;
    confidenceLevel: number;
    closeDate?: string | null;
    competition?: string | null;
    platformType?: string | null;
    consolidatedPainPoints?: string[] | null;
    consolidatedGoals?: string[] | null;
    consolidatedWhyAndWhyNow?: string[] | null;
    consolidatedMetrics?: string[] | null;
    consolidatedRiskAssessment?: {
      overall?: string;
      reasons?: string[];
      [key: string]: unknown;
    } | null;
    accountResearch?: string | null;
  };
  account?: {
    name: string;
    industry?: string | null;
    website?: string | null;
    ticker?: string | null;
  } | null;
  contacts: Array<{
    firstName: string;
    lastName: string;
    title?: string | null;
    role: string;
    sentiment: string;
  }>;
  template?: {
    title: string;
    body: string;
  } | null;
}

/**
 * Response from Business Impact Proposal generation
 */
export interface BusinessImpactProposalResponse {
  success: boolean;
  proposal?: string;
  error?: string;
}

/**
 * System instruction for Business Impact Proposal generation
 * Follows the 8-section template structure
 */
const BUSINESS_IMPACT_PROPOSAL_SYSTEM_INSTRUCTION = `You are a sales document specialist who creates compelling Business Impact Proposals for enterprise software deals.

Your task is to generate a single output: a Business Impact Proposal following a specific 8-section structure designed to help executives make a quick decision.

## OUTPUT FORMAT

Generate the proposal in clean markdown with these EXACT 8 sections. Use ## for section headers.

## 1. Headline

1-2 compelling sentences that summarize the transformation opportunity. This should grab executive attention and clearly state the value proposition.
Example: "Implementing automated credentialing will reduce compliance audit failures by 75% and accelerate practitioner onboarding by two weeks."

## 2. Problem Statement

1-3 sentences describing the current challenge with measurable pain points. Be specific and quantify the impact where possible.
Example: "Manual tracking of 500+ practitioner license expirations using spreadsheets results in an average of 15 practitioners falling out of compliance annually."

## 3. Recommended Approach

High-level summary of the proposed solution. Focus on the 'what' and 'how' in broad terms. Keep it concise - 2-4 sentences or bullet points.

## 4. Target Outcomes

Create a markdown table with SMART metrics:

| Metric | Current State (Baseline) | Target State (After Change) | Expected Impact |
|--------|-------------------------|----------------------------|-----------------|
| [Metric name] | [Current value or state] | [Target value or state] | [Brief impact description] |

Include 3-5 key metrics. Use real data from the opportunity when available.

## 5. Cost of Inaction

Detail the consequences of maintaining the status quo. Use this format:

**Risk:** [What bad things could happen if they don't act]

**Cost:** [What they're currently paying - time, money, resources - for the status quo]

**Opportunity Cost:** [What they're missing out on by not making this change]

## 6. Value Proposition

Break down the positive impacts of making the change:

**Financial Impact:** [Cost savings, revenue gains, ROI - be specific]

**Strategic Impact:** [Competitive advantage, market position, compliance, reputation]

**Operational Impact:** [Efficiency gains, time savings, team enablement, scalability]

## 7. Urgency & Timeline

Present compelling reasons to act now:

**Time-Sensitive Factor:** [Why timing matters - regulatory deadlines, market windows, competitive pressure]

**Dependency/Window:** [Current opportunities that enable action now]

**ROI Acceleration:** [How early action multiplies returns]

## 8. Required Investment

Leave this section with a placeholder for the sales rep to complete:

*[Investment details to be completed by sales representative]*

---

## DATA HANDLING RULES - CRITICAL

1. **Use actual data** from the opportunity context when available:
   - Pain points → Use consolidatedPainPoints for Problem Statement and Cost of Inaction
   - Goals → Use consolidatedGoals for Target Outcomes and Value Proposition
   - Metrics → Use consolidatedMetrics for the Target Outcomes table
   - Why/Why Now → Use consolidatedWhyAndWhyNow for Urgency section
   - Risk data → Use consolidatedRiskAssessment for Cost of Inaction

2. **For missing data**, use this exact placeholder format:
   \`[DATA NEEDED: brief description of what information is missing]\`

   Examples:
   - [DATA NEEDED: Current process time/cost baseline]
   - [DATA NEEDED: Quantified business impact metrics]
   - [DATA NEEDED: Specific compliance requirements or deadlines]

3. **Never fabricate specific numbers** - only use what's provided in the context
4. **Be explicit about gaps** - it's better to show "[DATA NEEDED]" than guess

## STYLE GUIDELINES

- Write in professional, executive-ready tone
- Be concise but impactful - executives scan, not read
- Use bullet points and tables for scanability
- Quantify wherever possible with real data
- Focus on business outcomes, not product features
- Tailor language to the customer's industry when known
- Make each section actionable and specific`;

/**
 * Build the prompt for Business Impact Proposal generation
 */
function buildBusinessImpactProposalPrompt(context: BusinessImpactProposalContext): string {
  const { opportunity, account, contacts, template } = context;

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

  // Format why and why now (business drivers)
  const whyAndWhyNowText =
    opportunity.consolidatedWhyAndWhyNow && opportunity.consolidatedWhyAndWhyNow.length > 0
      ? opportunity.consolidatedWhyAndWhyNow.map((w, i) => `${i + 1}. ${w}`).join("\n")
      : "No urgency factors documented yet.";

  // Format metrics
  const metricsText =
    opportunity.consolidatedMetrics && opportunity.consolidatedMetrics.length > 0
      ? opportunity.consolidatedMetrics.map((m, i) => `${i + 1}. ${m}`).join("\n")
      : "No quantifiable metrics documented yet.";

  // Format risk assessment
  let riskText = "No risk assessment available.";
  if (opportunity.consolidatedRiskAssessment) {
    const risk = opportunity.consolidatedRiskAssessment;
    if (risk.overall) {
      riskText = `Overall Risk Level: ${risk.overall}`;
      if (risk.reasons && Array.isArray(risk.reasons) && risk.reasons.length > 0) {
        riskText += "\nRisk Factors:\n" + risk.reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
      }
    }
  }

  // Format contacts by role
  const decisionMakers = contacts.filter((c) => c.role === "decision_maker");
  const champions = contacts.filter((c) => c.role === "champion");

  const formatContactList = (list: typeof contacts) =>
    list.length > 0
      ? list.map((c) => `- ${c.firstName} ${c.lastName} (${c.title || "No title"}) - ${c.sentiment}`).join("\n")
      : "- Not identified yet";

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

  // Format account research (truncate if too long)
  const accountResearchText = opportunity.accountResearch
    ? opportunity.accountResearch.length > 3000
      ? opportunity.accountResearch.substring(0, 3000) + "\n\n... (truncated)"
      : opportunity.accountResearch
    : "";

  // Include template if provided
  const templateSection = template
    ? `## Reference Template

The following template structure was provided by the user. Use it as a guide for formatting and tone:

---
${template.body.length > 5000 ? template.body.substring(0, 5000) + "\n... (truncated)" : template.body}
---

**IMPORTANT:** Follow the 8-section structure defined in your system instructions, but you may adapt the style and tone from this template.`
    : "";

  return `Generate a Business Impact Proposal for the following opportunity.

## Opportunity Overview

**Opportunity Name:** ${opportunity.name}
**Account:** ${account?.name || "Unknown"}
**Industry:** ${account?.industry || "Not specified"}
**Website:** ${account?.website || "Not provided"}
${account?.ticker ? `**Stock Ticker:** ${account.ticker}` : ""}
**Deal Size:** $${opportunity.amountArr.toLocaleString()} ARR
**Stage:** ${stageLabels[opportunity.stage] || opportunity.stage}
**Confidence Level:** ${opportunity.confidenceLevel}/5
**Close Date:** ${opportunity.closeDate || "Not set"}
${opportunity.platformType ? `**Platform Type:** ${opportunity.platformType.toUpperCase()}` : ""}
${opportunity.competition ? `**Competition:** ${opportunity.competition}` : ""}

## Customer Pain Points (from Sales Conversations)

${painPointsText}

## Customer Goals (from Sales Conversations)

${goalsText}

## Business Drivers / Urgency Factors (Why Now)

${whyAndWhyNowText}

## Quantifiable Metrics & ROI Data

${metricsText}

## Risk Assessment

${riskText}

## Key Stakeholders

**Decision Makers:**
${formatContactList(decisionMakers)}

**Champions:**
${formatContactList(champions)}

${accountResearchText ? `## Account Research\n\n${accountResearchText}` : ""}

${templateSection}

---

Generate the Business Impact Proposal now, following the exact 8-section structure specified in your instructions. Remember to use [DATA NEEDED: description] placeholders for any missing information.`;
}

/**
 * Generate a Business Impact Proposal using Gemini
 */
export async function generateBusinessImpactProposal(
  context: BusinessImpactProposalContext
): Promise<BusinessImpactProposalResponse> {
  try {
    const prompt = buildBusinessImpactProposalPrompt(context);

    const result = await generateWithSystemInstruction(
      prompt,
      BUSINESS_IMPACT_PROPOSAL_SYSTEM_INSTRUCTION,
      "gemini-3-pro-preview",
      3 // Standard 3 retries
    );

    if (result.error) {
      return {
        success: false,
        error: result.error,
      };
    }

    if (!result.text || result.text.trim().length === 0) {
      return {
        success: false,
        error: "Failed to generate Business Impact Proposal content",
      };
    }

    return {
      success: true,
      proposal: result.text.trim(),
    };
  } catch (error) {
    console.error("Error generating Business Impact Proposal:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
