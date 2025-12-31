/**
 * Token Estimation Utility for AI Content Generation
 *
 * Provides estimates of token usage based on selected context.
 * Uses character-based approximation (1 token ≈ 4 characters for English text).
 *
 * Note: This is an approximation. Actual token counts depend on the tokenizer used.
 * Gemini uses a different tokenizer than GPT models.
 */

// Approximate tokens per character ratio
// For English text, ~4 characters = 1 token on average
const CHARS_PER_TOKEN = 4;

// Maximum transcript length used in context-aggregator.ts
const MAX_TRANSCRIPT_LENGTH = 5000;

export interface TokenBreakdown {
  brief: {
    systemInstruction: number;
    outputFormat: number;
    sections: number;
    total: number;
  };
  context: {
    opportunity: number;
    account: number;
    contacts: number;
    consolidatedInsights: number;
    meetings: number;
    accountResearch: number;
    additionalContext: number;
    total: number;
  };
  totalEstimated: number;
  // Gemini model limits for reference
  modelLimits: {
    model: string;
    inputLimit: number;
    outputLimit: number;
  };
  percentageOfLimit: number;
}

export interface MeetingTokenEstimate {
  id: string;
  title: string;
  type: "gong" | "granola" | "google";
  estimatedTokens: number;
  hasTranscript: boolean;
  transcriptLength?: number;
  insightsCount: number;
}

export interface ContextTokenEstimates {
  consolidatedInsights: number;
  accountResearch: number;
  meetings: MeetingTokenEstimate[];
}

/**
 * Estimates tokens from character count
 */
export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * Estimates tokens from a string
 */
export function estimateTokensFromString(text: string | null | undefined): number {
  if (!text) return 0;
  return estimateTokensFromChars(text.length);
}

/**
 * Estimates tokens from a JSON object (serialized)
 */
export function estimateTokensFromJson(obj: unknown): number {
  if (!obj) return 0;
  try {
    const jsonString = JSON.stringify(obj);
    return estimateTokensFromString(jsonString);
  } catch {
    return 0;
  }
}

/**
 * Estimates tokens for a brief template
 */
export function estimateBriefTokens(brief: {
  systemInstruction?: string | null;
  outputFormat?: string | null;
  sections?: Array<{ title: string; description?: string }> | null;
}): TokenBreakdown["brief"] {
  const systemInstruction = estimateTokensFromString(brief.systemInstruction);
  const outputFormat = estimateTokensFromString(brief.outputFormat);
  const sections = brief.sections
    ? brief.sections.reduce((acc, section) => {
        return acc + estimateTokensFromString(section.title) + estimateTokensFromString(section.description);
      }, 0)
    : 0;

  return {
    systemInstruction,
    outputFormat,
    sections,
    total: systemInstruction + outputFormat + sections,
  };
}

/**
 * Estimates tokens for opportunity base context
 */
export function estimateOpportunityTokens(opportunity: {
  name: string;
  amountArr?: number;
  stage?: string;
  confidenceLevel?: number;
  closeDate?: Date | string | null;
  competition?: string | null;
  platformType?: string | null;
  nextStep?: string | null;
  notes?: string | null;
}): number {
  // Estimate based on formatted prompt structure
  let chars = 0;
  chars += ("## Opportunity Details\n").length;
  chars += (`- **Name:** ${opportunity.name}\n`).length;
  chars += (`- **ARR:** $${(opportunity.amountArr || 0).toLocaleString()}\n`).length;
  chars += (`- **Stage:** ${opportunity.stage || ""}\n`).length;
  chars += (`- **Confidence Level:** ${opportunity.confidenceLevel || 0}/5\n`).length;

  if (opportunity.closeDate) chars += 30; // Approximate date string
  if (opportunity.competition) chars += (`- **Competition:** ${opportunity.competition}\n`).length;
  if (opportunity.platformType) chars += (`- **Platform Type:** ${opportunity.platformType}\n`).length;
  if (opportunity.nextStep) chars += (`- **Next Steps:** ${opportunity.nextStep}\n`).length;

  return estimateTokensFromChars(chars);
}

/**
 * Estimates tokens for account context
 */
export function estimateAccountTokens(account: {
  name: string;
  industry?: string | null;
  website?: string | null;
  ticker?: string | null;
} | null): number {
  if (!account) return 0;

  let chars = 0;
  chars += ("## Account Information\n").length;
  chars += (`- **Company:** ${account.name}\n`).length;
  if (account.industry) chars += (`- **Industry:** ${account.industry}\n`).length;
  if (account.website) chars += (`- **Website:** ${account.website}\n`).length;
  if (account.ticker) chars += (`- **Ticker:** ${account.ticker}\n`).length;

  return estimateTokensFromChars(chars);
}

/**
 * Estimates tokens for contacts
 */
export function estimateContactsTokens(contacts: Array<{
  firstName: string;
  lastName: string;
  title?: string | null;
  role: string;
  sentiment: string;
}>): number {
  if (!contacts.length) return 0;

  let chars = ("## Key Contacts\n").length;
  for (const c of contacts) {
    chars += (`- ${c.firstName} ${c.lastName}${c.title ? ` (${c.title})` : ""} - ${c.role}, Sentiment: ${c.sentiment}\n`).length;
  }

  return estimateTokensFromChars(chars);
}

/**
 * Estimates tokens for consolidated insights
 */
export function estimateConsolidatedInsightsTokens(insights: {
  painPoints?: string[] | null;
  goals?: string[] | null;
  whyAndWhyNow?: string[] | null;
  quantifiableMetrics?: string[] | null;
  riskAssessment?: unknown | null;
} | null): number {
  if (!insights) return 0;

  let chars = ("## Consolidated Call Insights\n").length;

  const painPoints = (insights.painPoints as string[]) || [];
  const goals = (insights.goals as string[]) || [];
  const whyAndWhyNow = (insights.whyAndWhyNow as string[]) || [];
  const quantifiableMetrics = (insights.quantifiableMetrics as string[]) || [];

  if (painPoints.length > 0) {
    chars += ("### Pain Points\n").length;
    chars += painPoints.reduce((acc, p) => acc + (`- ${p}\n`).length, 0);
  }
  if (goals.length > 0) {
    chars += ("### Customer Goals\n").length;
    chars += goals.reduce((acc, g) => acc + (`- ${g}\n`).length, 0);
  }
  if (whyAndWhyNow.length > 0) {
    chars += ("### Why & Why Now\n").length;
    chars += whyAndWhyNow.reduce((acc, w) => acc + (`- ${w}\n`).length, 0);
  }
  if (quantifiableMetrics.length > 0) {
    chars += ("### Quantifiable Metrics\n").length;
    chars += quantifiableMetrics.reduce((acc, m) => acc + (`- ${m}\n`).length, 0);
  }

  // Add risk assessment if present
  if (insights.riskAssessment) {
    chars += estimateTokensFromJson(insights.riskAssessment) * CHARS_PER_TOKEN;
  }

  return estimateTokensFromChars(chars);
}

/**
 * Estimates tokens for a single meeting
 */
export function estimateMeetingTokens(
  meeting: {
    title: string;
    date?: Date | string;
    type: "gong" | "granola" | "google";
    transcriptText?: string | null;
    painPoints?: unknown[] | null;
    goals?: unknown[] | null;
    nextSteps?: unknown[] | null;
    whyAndWhyNow?: unknown[] | null;
    quantifiableMetrics?: unknown[] | null;
    // Enhanced extraction fields for token estimation
    keyQuotes?: unknown[] | null;
    objections?: unknown[] | null;
    competitionMentions?: unknown[] | null;
    decisionProcess?: unknown | null;
    callSentiment?: unknown | null;
  },
  options?: {
    includeTranscript?: boolean;
  }
): MeetingTokenEstimate & { id: string } {
  const includeTranscript = options?.includeTranscript ?? false;
  let chars = 0;

  // Header
  chars += (`### ${meeting.title} (date) - ${meeting.type.toUpperCase()}\n`).length;

  // Basic insights
  const painPoints = (meeting.painPoints as string[]) || [];
  const goals = (meeting.goals as string[]) || [];
  const nextSteps = (meeting.nextSteps as string[]) || [];

  if (painPoints.length > 0) {
    chars += (`**Pain Points:** ${painPoints.join("; ")}\n`).length;
  }
  if (goals.length > 0) {
    chars += (`**Goals:** ${goals.join("; ")}\n`).length;
  }
  if (nextSteps.length > 0) {
    chars += (`**Next Steps:** ${nextSteps.join("; ")}\n`).length;
  }

  // Enhanced extraction fields (always included when available)
  const keyQuotes = (meeting.keyQuotes as string[]) || [];
  const objections = (meeting.objections as string[]) || [];
  const competitionMentions = (meeting.competitionMentions as Array<{ competitor: string; context: string }>) || [];

  if (keyQuotes.length > 0) {
    chars += (`**Key Quotes:** ${keyQuotes.map(q => `"${q}"`).join("; ")}\n`).length;
  }
  if (objections.length > 0) {
    chars += (`**Objections:** ${objections.join("; ")}\n`).length;
  }
  if (competitionMentions.length > 0) {
    chars += (`**Competition Mentions:** ${competitionMentions.map(c => c.competitor).join(", ")}\n`).length;
  }
  if (meeting.decisionProcess) {
    chars += 100; // Approximate for decision process object
  }
  if (meeting.callSentiment) {
    chars += 50; // Approximate for sentiment object
  }

  // Transcript (only if explicitly requested)
  const hasTranscript = !!meeting.transcriptText;
  const transcriptLength = meeting.transcriptText
    ? Math.min(meeting.transcriptText.length, MAX_TRANSCRIPT_LENGTH)
    : 0;

  // Only count transcript tokens if includeTranscript is true
  if (includeTranscript && transcriptLength > 0) {
    chars += ("**Transcript Summary:** ").length;
    chars += transcriptLength;
  }

  const insightsCount = painPoints.length + goals.length + nextSteps.length +
    keyQuotes.length + objections.length + competitionMentions.length;

  return {
    id: "",
    title: meeting.title,
    type: meeting.type,
    estimatedTokens: estimateTokensFromChars(chars),
    hasTranscript,
    transcriptLength: includeTranscript ? transcriptLength : 0,
    insightsCount,
  };
}

/**
 * Estimates tokens for account research text
 */
export function estimateAccountResearchTokens(research: string | null | undefined): number {
  if (!research) return 0;
  return estimateTokensFromChars(("## Account Research\n").length + research.length);
}

/**
 * Estimates tokens for additional context
 */
export function estimateAdditionalContextTokens(context: string | null | undefined): number {
  if (!context) return 0;
  return estimateTokensFromChars(("## Additional Context from User\n").length + context.length);
}

/**
 * Gemini model token limits
 * Reference: https://ai.google.dev/models/gemini
 */
export const GEMINI_MODEL_LIMITS = {
  "gemini-1.5-pro": {
    model: "Gemini 1.5 Pro",
    inputLimit: 2_097_152, // 2M tokens
    outputLimit: 8_192,
  },
  "gemini-1.5-flash": {
    model: "Gemini 1.5 Flash",
    inputLimit: 1_048_576, // 1M tokens
    outputLimit: 8_192,
  },
  "gemini-2.0-flash-exp": {
    model: "Gemini 2.0 Flash",
    inputLimit: 1_048_576, // 1M tokens
    outputLimit: 8_192,
  },
} as const;

// Default model used in the application
export const DEFAULT_MODEL = "gemini-1.5-pro" as keyof typeof GEMINI_MODEL_LIMITS;

/**
 * Formats token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Gets a color class based on token usage percentage
 */
export function getTokenUsageColor(percentage: number): string {
  if (percentage >= 80) return "text-red-500";
  if (percentage >= 50) return "text-yellow-500";
  return "text-green-500";
}

/**
 * Gets a badge variant based on token count
 */
export function getTokenBadgeVariant(tokens: number): "default" | "secondary" | "destructive" | "outline" {
  if (tokens >= 50_000) return "destructive";
  if (tokens >= 20_000) return "secondary";
  return "outline";
}
