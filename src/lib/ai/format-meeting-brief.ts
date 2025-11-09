import type { MeetingBriefMetadata } from "@/types/opportunity";

/**
 * Complete meeting brief with all formats
 */
export interface FormattedMeetingBrief {
  fullBrief: string;
  mobileCheatSheet: string;
  metadata: MeetingBriefMetadata;
}

/**
 * Extract executive summary components from full brief text
 */
export function extractExecutiveSummary(fullBrief: string): MeetingBriefMetadata["executiveSummary"] {
  // Extract critical insight (first key insight after intro)
  const insightMatch = fullBrief.match(/\*\*Key Insight:\*\*\s*(.+?)(?:\n\n|$)/is);
  const criticalInsight = insightMatch
    ? insightMatch[1].trim().replace(/\*\*/g, "")
    : "Review full brief for context";

  // Extract opening line from conversation starters section
  const startersMatch = fullBrief.match(/##\s*10\.\s*Conversation Starters.+?-\s*\*\*Opening Line:\*\*\s*"(.+?)"/is);
  const openingLine = startersMatch ? startersMatch[1].trim() : "";

  // Extract top questions (first 3 from section 9)
  const questionsSection = fullBrief.match(/##\s*9\.\s*Discovery Questions.+?((?:\d+\..+?\n)+)/is);
  const topQuestions: string[] = [];
  if (questionsSection) {
    const matches = questionsSection[1].matchAll(/\d+\.\s*"(.+?)"/g);
    for (const match of matches) {
      topQuestions.push(match[1].trim());
      if (topQuestions.length >= 3) break;
    }
  }

  // Extract key metrics from financials section
  const keyMetrics: Array<{ metric: string; value: string; talkingPoint: string }> = [];
  const financialsMatch = fullBrief.match(/Latest Financials.+?:([\s\S]+?)(?=\n-|\n\n##)/i);
  if (financialsMatch) {
    const lines = financialsMatch[1].split("\n");
    for (const line of lines) {
      const metricMatch = line.match(/\*\*(.+?):\*\*\s*(.+)/);
      if (metricMatch && keyMetrics.length < 3) {
        keyMetrics.push({
          metric: metricMatch[1].trim(),
          value: metricMatch[2].trim(),
          talkingPoint: `Reference ${metricMatch[1].toLowerCase()} in conversation`,
        });
      }
    }
  }

  // Extract risks from pain points section
  const risks: string[] = [];
  const painPointsMatch = fullBrief.match(/##\s*4\.\s*Pain Points.+?([\s\S]+?)(?=\n##)/i);
  if (painPointsMatch) {
    const lines = painPointsMatch[1].split("\n");
    for (const line of lines) {
      if (line.trim().startsWith("-") && risks.length < 3) {
        risks.push(line.replace(/^-\s*\*\*(.+?):\*\*\s*/, "").trim());
      }
    }
  }

  return {
    criticalInsight,
    topQuestions,
    keyMetrics,
    risks,
    openingLine,
  };
}

/**
 * Parse discovery questions with priority and context
 */
export function parseDiscoveryQuestions(
  fullBrief: string
): MeetingBriefMetadata["quickReference"]["discoveryQuestions"] {
  const questions: MeetingBriefMetadata["quickReference"]["discoveryQuestions"] = [];
  const questionsSection = fullBrief.match(/##\s*9\.\s*Discovery Questions.+?((?:\d+\..+?(?:\n(?!\d+\.).*)*)+)/is);

  if (questionsSection) {
    const questionBlocks = questionsSection[1].split(/\n\d+\.\s+/);

    for (let i = 0; i < questionBlocks.length && questions.length < 6; i++) {
      const block = questionBlocks[i].trim();
      if (!block) continue;

      const questionMatch = block.match(/"(.+?)"/);
      if (questionMatch) {
        // Prioritize first 2 as HIGH, next 2 as MEDIUM, rest as OPTIONAL
        const priority = i < 2 ? "HIGH" : i < 4 ? "MEDIUM" : "OPTIONAL";

        questions.push({
          priority,
          question: questionMatch[1].trim(),
          whyAsk: `Uncovers key information for this stage`,
          listenFor: ["Specific timelines", "Pain points", "Decision criteria"],
        });
      }
    }
  }

  return questions;
}

/**
 * Extract conversation starters
 */
export function extractConversationStarters(fullBrief: string): string[] {
  const starters: string[] = [];
  const startersSection = fullBrief.match(/##\s*10\.\s*Conversation Starters.+?([\s\S]+?)(?=\n##|$)/i);

  if (startersSection) {
    const lines = startersSection[1].split("\n");
    for (const line of lines) {
      if (line.trim().startsWith("-") && starters.length < 3) {
        const cleaned = line.replace(/^-\s*\*\*(.+?):\*\*\s*/, "").replace(/"/g, "").trim();
        if (cleaned && cleaned.length > 20) {
          starters.push(cleaned);
        }
      }
    }
  }

  return starters;
}

/**
 * Extract financials in table format
 */
export function extractFinancials(
  fullBrief: string
): MeetingBriefMetadata["quickReference"]["financials"] {
  const financials: MeetingBriefMetadata["quickReference"]["financials"] = [];
  const financialsMatch = fullBrief.match(/Latest Financials.+?:([\s\S]+?)(?=\n-|\n\n##)/i);

  if (financialsMatch) {
    const lines = financialsMatch[1].split("\n");
    for (const line of lines) {
      const metricMatch = line.match(/\*\*(.+?):\*\*\s*\$?([\d.]+[BMK]?(?:\s+billion|\s+million)?)\s*(?:\((.+?)\))?/i);
      if (metricMatch && financials.length < 4) {
        financials.push({
          metric: metricMatch[1].trim(),
          value: `$${metricMatch[2].trim()}`,
          yoyChange: metricMatch[3] || "",
          howToUse: `Reference ${metricMatch[1].toLowerCase()} growth`,
        });
      }
    }
  }

  return financials;
}

/**
 * Generate mobile cheat sheet from metadata
 */
export function generateMobileCheatSheet(metadata: MeetingBriefMetadata, accountName: string): string {
  const { executiveSummary, quickReference } = metadata;

  return `📱 MOBILE CHEAT SHEET: ${accountName}

⚡ CRITICAL INSIGHT
${executiveSummary.criticalInsight}

💬 OPENING LINE
"${executiveSummary.openingLine}"

❓ TOP 3 QUESTIONS
${executiveSummary.topQuestions.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

📊 KEY STATS
${executiveSummary.keyMetrics.map((m) => `• ${m.metric}: ${m.value}`).join("\n")}

🚩 RISKS/DON'TS
${executiveSummary.risks.map((r) => `• ${r}`).join("\n")}

💡 CONVERSATION STARTERS
${quickReference.conversationStarters.slice(0, 2).map((s, i) => `${i + 1}. ${s}`).join("\n\n")}

---
Generated: ${new Date().toLocaleDateString()}`;
}

/**
 * Create metadata structure from full brief
 */
export function parseFullBriefToMetadata(fullBrief: string): MeetingBriefMetadata {
  const executiveSummary = extractExecutiveSummary(fullBrief);
  const discoveryQuestions = parseDiscoveryQuestions(fullBrief);
  const conversationStarters = extractConversationStarters(fullBrief);
  const financials = extractFinancials(fullBrief);

  return {
    executiveSummary,
    quickReference: {
      conversationStarters,
      discoveryQuestions,
      financials,
    },
  };
}

/**
 * Format full brief with enhanced structure
 */
export function enhanceFullBrief(fullBrief: string, metadata: MeetingBriefMetadata): string {
  const { executiveSummary } = metadata;

  // Create executive summary section
  const execSummary = `
## 🎯 EXECUTIVE SUMMARY (Read This First)

**🔴 Critical Insight:**
${executiveSummary.criticalInsight}

**💬 Your Opening Line:**
> "${executiveSummary.openingLine}"

**📊 Key Data Points to Reference:**
${executiveSummary.keyMetrics.map((m) => `- **${m.metric}:** ${m.value} → *${m.talkingPoint}*`).join("\n")}

**⚡ Top 3 Questions to Ask:**
${executiveSummary.topQuestions.map((q, i) => `${i + 1}. ✅ "${q}"`).join("\n")}

**🚩 Risks to Address:**
${executiveSummary.risks.map((r) => `- ${r}`).join("\n")}

---
`;

  // Insert executive summary at the beginning (after any intro text)
  const briefWithSummary = fullBrief.replace(/(^[\s\S]+?)(## 1\.|## Business Overview)/i, `$1${execSummary}\n$2`);

  return briefWithSummary;
}

/**
 * Main formatting function - converts raw AI output to structured formats
 */
export function formatMeetingBrief(fullBrief: string, accountName: string): FormattedMeetingBrief {
  // Parse the full brief into structured metadata
  const metadata = parseFullBriefToMetadata(fullBrief);

  // Generate mobile cheat sheet
  const mobileCheatSheet = generateMobileCheatSheet(metadata, accountName);

  // Enhance full brief with executive summary
  const enhancedFullBrief = enhanceFullBrief(fullBrief, metadata);

  return {
    fullBrief: enhancedFullBrief,
    mobileCheatSheet,
    metadata,
  };
}
