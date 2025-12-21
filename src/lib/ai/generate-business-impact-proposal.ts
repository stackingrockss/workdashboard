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
  /** Optional additional context provided by the user at generation time */
  additionalContext?: string | null;
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
const BUSINESS_IMPACT_PROPOSAL_SYSTEM_INSTRUCTION = `You are an enterprise sales expert who creates compelling Business Impact Proposals that help executives make quick, confident decisions.

Your task is to generate a Business Impact Proposal following a specific 8-section structure. Use the customer's actual words, vocabulary, and specific terminology from their conversations - avoid generic or fluffy language.

## CORE PRINCIPLES

1. **Use the customer's own language** - Mirror their exact words, phrases, project names, and terminology from calls/notes
2. **Ground everything in specifics** - Include actual numbers, metrics, dates, and strategic priorities they've mentioned
3. **Focus on business outcomes** - Executive-level impact, not product features
4. **No assumptions** - Only use what's provided; use placeholders for gaps

## OUTPUT FORMAT

Generate the proposal in clean markdown with these EXACT 8 sections. Use ## for section headers.

## 1. Headline

1-2 compelling sentences that summarize the transformation opportunity using the customer's own framing of the problem and desired outcome.
Example: "Implementing automated credentialing will reduce compliance audit failures by 75% and accelerate practitioner onboarding by two weeks."

## 2. Problem Statement

A comprehensive problem statement that includes:
- **Current State:** What's happening today (use customer's words)
- **Failed Attempts:** What they've already tried that didn't work (if mentioned)
- **Goal Impact:** How this problem affects their company-wide strategic goals
- **Worsening Trend:** Why this is getting worse, not staying stable

Be specific and quantify the impact where possible. Reference specific project names, systems, or initiatives they've mentioned.

Example: "The compliance team manually tracks 500+ practitioner license expirations using spreadsheets, resulting in an average of 15 practitioners falling out of compliance annually. Previous attempts to use their existing HR system failed due to lack of automated alerts. With the upcoming Joint Commission audit in Q2 and 30% projected headcount growth, this manual process is becoming unsustainable."

## 3. Recommended Approach

Structure this section in two parts:

**What Must Be True (Solution Criteria):**
First, establish the vendor-agnostic requirements that any solution must meet. These should come from what the customer has said they need.

**Key Differentiators:**
Then, highlight 2-3 specific capabilities that align to those criteria and explain why they matter for this customer's situation.

## 4. Target Outcomes

Create a markdown table focused on **second and third-level business metrics** - not surface-level product benefits:

| Metric | Current State (Baseline) | Target State (After Change) | Business Impact |
|--------|-------------------------|----------------------------|-----------------|
| [Business outcome metric] | [Current value] | [Target value] | [Revenue/margin/strategic impact] |

**Metric Hierarchy:**
- Surface-level (avoid): "Reduce onboarding time by 50%"
- Second-level (good): "Enable 20% faster revenue recognition from new hires"
- Third-level (best): "Improve quarterly earnings guidance accuracy"

Include 3-5 key metrics. Prioritize metrics the customer has explicitly mentioned caring about.

## 5. Cost of Inaction

Detail the consequences of maintaining the status quo:

**Risk:** What specific bad outcomes could happen if they don't act (reference their industry, compliance requirements, competitive situation)

**Current Cost:** What they're paying today - time, money, resources, opportunity - for the status quo. Use their numbers when available.

**Opportunity Cost:** What they're missing out on - tie to their stated strategic goals

**Worsening Factors:** Why waiting makes this worse (growing team, upcoming deadlines, market changes they've mentioned)

## 6. Value Proposition

Break down the positive impacts, grounded in what they've said matters to them:

**Financial Impact:** Specific cost savings, revenue gains, ROI - use their numbers and calculation methods when possible

**Strategic Impact:** How this advances their stated strategic priorities (reference specific initiatives or goals they've mentioned)

**Operational Impact:** Efficiency gains, team enablement, scalability - in their terms

If they've mentioned why your solution is a top option in their evaluation, include that rationale here.

## 7. Urgency & Timeline

Present compelling reasons to act now, using their own timeline and drivers:

**Time-Sensitive Factor:** Specific deadlines, regulatory dates, market windows, or competitive pressures they've mentioned

**Dependency/Window:** Current conditions that enable action (budget cycle, leadership support, project timing)

**ROI Acceleration:** How acting sooner multiplies returns - be specific to their situation

## 8. Required Investment

Provide as much detail as available from customer conversations:

**Timeline & Milestones:**
- Key dates and deadlines mentioned by customer
- Implementation phases if discussed

**Resources Required:**
- Customer-side teams/people involved
- Time commitment expectations

**Evaluation Next Steps:**
- Decision process and timeline
- Key stakeholders and their roles
- Upcoming meetings or milestones

Use [DATA NEEDED: description] for any missing specifics.

---

## DATA HANDLING RULES - CRITICAL

1. **Use actual data** from the opportunity context when available:
   - Pain points → Use consolidatedPainPoints for Problem Statement and Cost of Inaction
   - Goals → Use consolidatedGoals for Target Outcomes and Value Proposition
   - Metrics → Use consolidatedMetrics for the Target Outcomes table
   - Why/Why Now → Use consolidatedWhyAndWhyNow for Urgency section
   - Risk data → Use consolidatedRiskAssessment for Cost of Inaction
   - Account research → Use for industry context, strategic initiatives, and company-specific details

2. **For missing data**, use this exact placeholder format:
   \`[DATA NEEDED: brief description of what information is missing]\`

   Examples:
   - [DATA NEEDED: Current process time/cost baseline]
   - [DATA NEEDED: Quantified business impact metrics]
   - [DATA NEEDED: Specific compliance requirements or deadlines]
   - [DATA NEEDED: Previous solution attempts and why they failed]
   - [DATA NEEDED: Customer's evaluation timeline and decision process]

3. **Never fabricate specific numbers** - only use what's provided in the context
4. **Be explicit about gaps** - it's better to show "[DATA NEEDED]" than guess
5. **Reference failed attempts** - if the customer mentioned previous solutions that didn't work, include this context

## STYLE GUIDELINES

- **Mirror the customer's vocabulary** - use their exact words, phrases, and terminology from calls/notes
- Write in professional, executive-ready tone
- Be concise but impactful - executives scan, not read
- Use bullet points and tables for scanability
- Quantify wherever possible with real data
- Focus on business outcomes, not product features
- Tailor language to the customer's industry
- Make each section actionable and specific
- Push metrics to business outcomes (revenue, margin, strategic goals) not just operational improvements
- No generic statements - everything should be grounded in the customer's specific context`;

/**
 * Build the prompt for Business Impact Proposal generation
 */
function buildBusinessImpactProposalPrompt(context: BusinessImpactProposalContext): string {
  const { opportunity, account, contacts, template, additionalContext } = context;

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

${additionalContext ? `## Additional Context from Sales Rep\n\nThe following additional context was provided for this proposal generation. Incorporate this information where relevant:\n\n${additionalContext}` : ""}

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
