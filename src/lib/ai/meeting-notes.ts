import { generateWithSystemInstruction } from "./gemini";

/**
 * Context for generating pre-meeting notes
 */
export interface MeetingNotesContext {
  accountName: string;
  companyWebsite?: string;
  stage?: string;
  industry?: string;
  opportunityValue?: number;
}

/**
 * Response from meeting notes generation
 */
export interface MeetingNotesResponse {
  notes: string; // Legacy field for backward compatibility
  fullBrief: string;
  success: boolean;
  error?: string;
}

/**
 * System instruction for Gemini - defines Verifiable's context and role
 */
const VERIFIABLE_CONTEXT = `You are a sales intelligence assistant for Verifiable (www.verifiable.com), a healthcare technology company.

ABOUT VERIFIABLE:
- Products: Credentialing Software, Provider Network Monitoring, Primary Source Verifications, NCQA-Certified CVO Services
- Target Customers: Health Plans, Provider Organizations, Healthcare Networks
- Key Value Props:
  * Automate NCQA-compliant credentialing workflows
  * Eliminate 76% of manual credentialing work
  * Real-time primary source verifications
  * Always-on compliance monitoring
  * Scale provider networks from 100 to 1M+ providers
  * Salesforce integration
  * Reduce operational costs and improve provider data quality

YOUR ROLE:
Generate comprehensive pre-meeting intelligence for enterprise sales calls (6-7 figure deals).
Focus on actionable insights that help sales reps have informed, consultative conversations.
Research should be current, specific, and directly relevant to credentialing/provider network challenges.

OUTPUT FORMAT:
Use clean, readable formatting:
- Use simple headers (## only, no ###) to separate major sections
- Use bullet points (-) for lists instead of bold text for every item
- Avoid excessive bold (**) formatting - use it ONLY for critical numbers, company names on first mention, or key takeaways
- Use natural paragraph formatting for narrative sections
- Keep it concise but thorough - aim for a 2-3 minute read
- Focus on facts over speculation, but do highlight likely pain points based on industry knowledge.

FORMATTING RULES:
✅ DO: Use clean bullets with natural text flow
✅ DO: Use bold sparingly for key numbers and critical insights
❌ DON'T: Use ### subheaders (they create visual clutter)
❌ DON'T: Bold every field name or label
❌ DON'T: Use excessive asterisks - let content stand on its own`;

/**
 * Generate pre-meeting notes prompt
 */
function buildMeetingNotesPrompt(context: MeetingNotesContext): string {
  const { accountName, companyWebsite, stage, industry, opportunityValue } = context;

  return `Generate comprehensive pre-meeting sales intelligence for an enterprise sales call with: ${accountName}

${companyWebsite ? `Company Website: ${companyWebsite}\nUse the company website to gather accurate, current information about their products, services, and positioning.\n` : ""}
${industry ? `Industry: ${industry}` : ""}
${stage ? `Opportunity Stage: ${stage}` : ""}
${opportunityValue ? `Estimated Deal Value: $${opportunityValue.toLocaleString()}` : ""}

Please research and provide the following sections:

## 1. Business Overview
- How does ${accountName} make money? (revenue model, key products/services)
- **Latest Financials:** Provide specific revenue/growth numbers in format: **Metric Name:** $XXX million/billion (YoY change)
- Strategic goals and initiatives (from recent earnings calls, press releases, or public statements)
- Company size (employees, market cap if public)

## 2. Healthcare & Provider Network Context
- CRITICAL: Estimate their provider network size (number of credentialed providers)
- Number of facilities/locations
- Geographic footprint
- Health plan membership numbers (if applicable)
- Provider types in their network (physicians, hospitals, specialists, etc.)

## 3. Recent News & Events (Last 12 Months)
- M&A activity, partnerships, or expansions
- Leadership changes (new CXOs often drive new vendor selections)
- Regulatory pressures or compliance issues
- Major strategic announcements

## 4. Pain Points & Challenges
Format each pain point as: **Pain Point Name:** Description
- Industry-specific challenges they're likely facing
- Public mentions of operational issues or inefficiencies
- Technology modernization needs
- Known credentialing or provider network management challenges

## 5. Tech Stack & Current Vendors (if publicly available)
- Current credentialing or provider data management systems
- Recent technology investments or digital transformation initiatives
- Integration requirements (known platforms they use)
- Technology modernization efforts

## 6. Competitive Position
- Market position vs. competitors in their industry
- Differentiation strategy
- Growth trajectory and expansion plans
- Market share trends

## 7. Decision-Making Context
- Typical buying committee structure for a company of their size/industry
- Key stakeholder titles and roles to engage (e.g., VP Provider Network Operations, CMO, CIO)
- Budget cycles and procurement timing considerations
- Complexity of decision-making process

## 8. Verifiable-Specific Fit
Begin this section with: **Key Insight:** [One sentence explaining why NOW is the right time for Verifiable]

Then provide:
- Specific pain points Verifiable solves for companies like them
- Estimated ROI based on their provider network size (use Verifiable's 76% manual work reduction claim)
- Most relevant Verifiable solutions (CVO services, software, network monitoring)
- Integration considerations with their likely tech stack

## 9. Discovery Questions
Provide 5-7 questions in this exact format:
1. "Question text here?"
2. "Question text here?"
3. "Question text here?"

Base questions on:
- Their recent activity and news
- Credentialing volume and current processes
- Pain points in provider network management
- Current vendor satisfaction and contract timing
- Strategic initiatives that Verifiable could support

## 10. Conversation Starters & Social Proof
Start with: **Opening Line:** "Exact quote to open the conversation"

Then provide:
- Relevant industry trends affecting them
- Similar companies (peer organizations) that use Verifiable
- Relevant case studies or ROI examples for their industry/size

---

**Research Instructions:**
- Prioritize recent, factual information
- If exact data isn't available, provide educated estimates with caveats
- Focus on healthcare/provider network specific intelligence
- Highlight timing factors that make this a good time to engage
- Be specific about how Verifiable's solutions map to their challenges

**FORMATTING REQUIREMENTS:**
- Section 4: Use **Pain Point Name:** format for each bullet
- Section 8: Start with **Key Insight:** on first line
- Section 9: Put all questions in quotes
- Section 10: Start with **Opening Line:** in quotes

Generate comprehensive, actionable intelligence that prepares the sales rep for a consultative, value-driven conversation.`;
}

/**
 * Generate pre-meeting notes using Gemini
 */
export async function generatePreMeetingNotes(
  context: MeetingNotesContext
): Promise<MeetingNotesResponse> {
  try {
    if (!context.accountName || context.accountName.trim().length === 0) {
      return {
        success: false,
        notes: "",
        fullBrief: "",
        error: "Account name is required",
      };
    }

    const prompt = buildMeetingNotesPrompt(context);

    // Use Gemini 3 Pro for superior research quality
    const result = await generateWithSystemInstruction(
      prompt,
      VERIFIABLE_CONTEXT,
      "gemini-3-pro-preview",
      3 // Standard 3 retries
    );

    if (result.error) {
      return {
        success: false,
        notes: "",
        fullBrief: "",
        error: result.error,
      };
    }

    return {
      success: true,
      notes: result.text, // Legacy field
      fullBrief: result.text,
    };
  } catch (error) {
    console.error("Error generating meeting notes:", error);
    return {
      success: false,
      notes: "",
      fullBrief: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
