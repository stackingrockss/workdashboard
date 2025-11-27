import { prisma } from "@/lib/db";
import { ContentType } from "@prisma/client";
import { generateWithWebSearch, GeminiWebSearchResponse } from "./gemini";

/**
 * Content suggestion result from AI
 */
export interface ContentSuggestion {
  source: "internal" | "web";
  id?: string; // Only for internal content
  title: string;
  url: string;
  contentType: ContentType;
  description?: string;
  relevanceReason: string;
}

/**
 * Result from content suggestion generation
 */
export interface ContentSuggestionResult {
  suggestions: ContentSuggestion[];
  summary: string;
  webSearchUsed: boolean;
  error?: string;
}

/**
 * System instruction for content suggestion AI
 */
export const CONTENT_SUGGESTION_SYSTEM_INSTRUCTION = `You are a sales enablement specialist helping sales representatives find and suggest relevant content for their opportunities.

**YOUR ROLE:**
- Analyze the customer's pain points, goals, and account context
- Review the ENTIRE internal content library provided below
- Select the 3-5 MOST relevant internal items based on semantic understanding
- Supplement with web-sourced content via Google Search grounding
- Explain WHY each piece of content is relevant to this opportunity

**RESPONSE FORMAT:**
You must respond with a natural conversational style that embeds structured content cards.

1. Start with an introductory paragraph explaining the recommendations
2. Insert content cards using this exact format:
   [CONTENT_CARD]{"source":"internal","id":"clx123","title":"...","url":"...","contentType":"...","description":"...","relevanceReason":"..."}[/CONTENT_CARD]
3. Add explanatory sentences between cards explaining their relevance
4. End with usage advice (when to send, how to position, etc.)

**CONTENT CARD RULES:**
- Use double quotes for all JSON keys and string values
- Escape any quotes inside string values using backslash
- Valid contentType values: "case_study", "blog_post", "whitepaper", "video", "webinar", "other"
- Valid source values: "internal" or "web"
- Include "id" field only for internal content
- Keep description under 150 characters
- relevanceReason should tie directly to customer pain points or goals

**CONTENT SELECTION RULES:**
1. Review ALL internal library items semantically - don't just match keywords
2. Consider context: pain points, goals, industry, account research, deal stage
3. Prioritize internal library content when genuinely relevant
4. Use web search to supplement (not replace) internal content
5. Limit to 5-7 suggestions maximum
6. Include a mix of content types when available (case studies + whitepapers + videos)
7. Match content to deal stage (early stage = educational, late stage = validation/ROI)
8. Be honest if no relevant content exists - suggest what type would help instead

**WRITING STYLE:**
- Be conversational and helpful, not robotic
- Explain the "why" behind each suggestion
- Connect content to specific customer concerns mentioned in context
- Give actionable advice on how to use the content
- Keep total response under 500 words`;

/**
 * Build prompt for opportunity content suggestions
 */
function buildOpportunityContentSuggestionPrompt(params: {
  userQuery: string;
  allContent: Array<{
    id: string;
    title: string;
    url: string;
    description: string | null;
    body: string | null;
    contentType: ContentType;
  }>;
  opportunityContext: {
    opportunityName: string;
    accountName: string;
    industry?: string;
    stage: string;
    painPoints: string[];
    goals: string[];
    accountResearch?: string;
  };
}): string {
  const { userQuery, allContent, opportunityContext } = params;

  return `## Content Suggestion Request

**User Query:** ${userQuery}

## Opportunity Context

**Opportunity:** ${opportunityContext.opportunityName}
**Account:** ${opportunityContext.accountName}
**Industry:** ${opportunityContext.industry || "Unknown"}
**Deal Stage:** ${opportunityContext.stage}

**Customer Pain Points:**
${
  opportunityContext.painPoints.length > 0
    ? opportunityContext.painPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")
    : "No pain points documented yet."
}

**Customer Goals:**
${
  opportunityContext.goals.length > 0
    ? opportunityContext.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")
    : "No goals documented yet."
}

${opportunityContext.accountResearch ? `**Account Research:**\n${opportunityContext.accountResearch}\n` : ""}

## Internal Content Library (All ${allContent.length} items)

${
  allContent.length > 0
    ? allContent
        .map(
          (c, i) => `
**${i + 1}. ${c.title}**
- Type: ${c.contentType}
- URL: ${c.url}
- Description: ${c.description || "No description"}
${c.body ? `- Content Preview: ${c.body.substring(0, 500)}...` : ""}
`
        )
        .join("\n")
    : "No content in library yet. Please search the web for relevant materials."
}

**IMPORTANT:** When selecting content, read the full body text (if available) to understand semantic relevance, not just keywords in titles.

---

Based on the opportunity context${
    allContent.length > 0 ? " and internal content library" : ""
  }, recommend the most relevant content for this opportunity. Remember to use the [CONTENT_CARD] format and explain why each piece is relevant.`;
}

/**
 * Build prompt for account content suggestions
 */
function buildAccountContentSuggestionPrompt(params: {
  userQuery: string;
  allContent: Array<{
    id: string;
    title: string;
    url: string;
    description: string | null;
    body: string | null;
    contentType: ContentType;
  }>;
  accountContext: {
    accountName: string;
    industry?: string;
    opportunityCount: number;
    hasEarningsData: boolean;
    hasSECFilings: boolean;
    accountResearch?: string;
  };
}): string {
  const { userQuery, allContent, accountContext } = params;

  return `## Content Suggestion Request

**User Query:** ${userQuery}

## Account Context

**Account:** ${accountContext.accountName}
**Industry:** ${accountContext.industry || "Unknown"}
**Active Opportunities:** ${accountContext.opportunityCount}
**Earnings Data Available:** ${accountContext.hasEarningsData ? "Yes" : "No"}
**SEC Filings Available:** ${accountContext.hasSECFilings ? "Yes" : "No"}

${accountContext.accountResearch ? `**Account Research:**\n${accountContext.accountResearch}\n` : ""}

## Internal Content Library (All ${allContent.length} items)

${
  allContent.length > 0
    ? allContent
        .map(
          (c, i) => `
**${i + 1}. ${c.title}**
- Type: ${c.contentType}
- URL: ${c.url}
- Description: ${c.description || "No description"}
${c.body ? `- Content Preview: ${c.body.substring(0, 500)}...` : ""}
`
        )
        .join("\n")
    : "No content in library yet. Please search the web for relevant materials."
}

**IMPORTANT:** When selecting content, read the full body text (if available) to understand semantic relevance, not just keywords in titles.

---

Based on the account context${
    allContent.length > 0 ? " and internal content library" : ""
  }, recommend the most relevant content for this account. Remember to use the [CONTENT_CARD] format and explain why each piece is relevant.`;
}

/**
 * Parse AI response to extract content suggestions
 */
function parseContentSuggestions(aiResponse: string): ContentSuggestion[] {
  const suggestions: ContentSuggestion[] = [];
  const regex = /\[CONTENT_CARD\](.*?)\[\/CONTENT_CARD\]/gs;

  let match;
  while ((match = regex.exec(aiResponse)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (
        parsed.source &&
        parsed.title &&
        parsed.url &&
        parsed.contentType &&
        parsed.relevanceReason
      ) {
        suggestions.push({
          source: parsed.source,
          id: parsed.id,
          title: parsed.title,
          url: parsed.url,
          contentType: parsed.contentType,
          description: parsed.description,
          relevanceReason: parsed.relevanceReason,
        });
      }
    } catch (error) {
      console.error("[parseContentSuggestions] Failed to parse card:", match[1], error);
    }
  }

  return suggestions;
}

/**
 * Generate content suggestions for an opportunity
 */
export async function generateContentSuggestionsForOpportunity(
  opportunityId: string,
  organizationId: string,
  userQuery: string
): Promise<ContentSuggestionResult> {
  try {
    // Fetch opportunity with context
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        stage: true,
        consolidatedPainPoints: true,
        consolidatedGoals: true,
        account: {
          select: {
            name: true,
            industry: true,
          },
        },
      },
    });

    if (!opportunity) {
      return {
        suggestions: [],
        summary: "",
        webSearchUsed: false,
        error: "Opportunity not found",
      };
    }

    // Extract pain points and goals
    const painPoints = Array.isArray(opportunity.consolidatedPainPoints)
      ? (opportunity.consolidatedPainPoints as string[])
      : [];
    const goals = Array.isArray(opportunity.consolidatedGoals)
      ? (opportunity.consolidatedGoals as string[])
      : [];

    // Fetch ALL content from library (let Gemini decide relevance)
    const allContent = await prisma.content.findMany({
      where: { organizationId },
      select: {
        id: true,
        title: true,
        description: true,
        body: true,
        url: true,
        contentType: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Build prompt
    const prompt = buildOpportunityContentSuggestionPrompt({
      userQuery,
      allContent,
      opportunityContext: {
        opportunityName: opportunity.name,
        accountName: opportunity.account?.name || "Unknown",
        industry: opportunity.account?.industry || undefined,
        stage: opportunity.stage,
        painPoints,
        goals,
      },
    });

    // Call AI with web search enabled (Gemini will decide when to search)
    const aiResponse = await generateWithWebSearch(
      prompt,
      CONTENT_SUGGESTION_SYSTEM_INSTRUCTION
    );

    if (aiResponse.error) {
      return {
        suggestions: [],
        summary: "",
        webSearchUsed: true,
        error: aiResponse.error,
      };
    }

    // Parse suggestions from response
    const suggestions = parseContentSuggestions(aiResponse.text);

    // Extract summary (text before first card or entire text if no cards)
    const firstCardIndex = aiResponse.text.indexOf("[CONTENT_CARD]");
    const summary =
      firstCardIndex > 0
        ? aiResponse.text.substring(0, firstCardIndex).trim()
        : aiResponse.text.trim();

    return {
      suggestions,
      summary,
      webSearchUsed: true,
    };
  } catch (error) {
    console.error("[generateContentSuggestionsForOpportunity] Error:", error);
    return {
      suggestions: [],
      summary: "",
      webSearchUsed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate content suggestions for an account
 */
export async function generateContentSuggestionsForAccount(
  accountId: string,
  organizationId: string,
  userQuery: string
): Promise<ContentSuggestionResult> {
  try {
    // Fetch account with context
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        industry: true,
        opportunities: {
          select: {
            id: true,
          },
        },
        earningsTranscripts: {
          select: {
            id: true,
          },
          take: 1,
        },
        secFilings: {
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!account) {
      return {
        suggestions: [],
        summary: "",
        webSearchUsed: false,
        error: "Account not found",
      };
    }

    // Fetch ALL content from library (let Gemini decide relevance)
    const allContent = await prisma.content.findMany({
      where: { organizationId },
      select: {
        id: true,
        title: true,
        description: true,
        body: true,
        url: true,
        contentType: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Build prompt
    const prompt = buildAccountContentSuggestionPrompt({
      userQuery,
      allContent,
      accountContext: {
        accountName: account.name,
        industry: account.industry || undefined,
        opportunityCount: account.opportunities.length,
        hasEarningsData: account.earningsTranscripts.length > 0,
        hasSECFilings: account.secFilings.length > 0,
      },
    });

    // Call AI with web search enabled (Gemini will decide when to search)
    const aiResponse = await generateWithWebSearch(
      prompt,
      CONTENT_SUGGESTION_SYSTEM_INSTRUCTION
    );

    if (aiResponse.error) {
      return {
        suggestions: [],
        summary: "",
        webSearchUsed: true,
        error: aiResponse.error,
      };
    }

    // Parse suggestions from response
    const suggestions = parseContentSuggestions(aiResponse.text);

    // Extract summary
    const firstCardIndex = aiResponse.text.indexOf("[CONTENT_CARD]");
    const summary =
      firstCardIndex > 0
        ? aiResponse.text.substring(0, firstCardIndex).trim()
        : aiResponse.text.trim();

    return {
      suggestions,
      summary,
      webSearchUsed: true,
    };
  } catch (error) {
    console.error("[generateContentSuggestionsForAccount] Error:", error);
    return {
      suggestions: [],
      summary: "",
      webSearchUsed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
