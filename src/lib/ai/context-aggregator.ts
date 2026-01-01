/**
 * Context Aggregator for AI Content Generation Framework
 *
 * Aggregates context from multiple sources (meetings, notes, account research, etc.)
 * to build a comprehensive context object for AI generation.
 */

import { prisma } from "@/lib/db";
import { ContextSelectionInput } from "@/lib/validations/framework";
import { formatDateShort } from "@/lib/format";
import type {
  CompetitionMention,
  DecisionProcess,
  CallSentiment,
  ConsolidatedCompetition,
  ConsolidatedDecisionProcess,
  ConsolidatedSentimentTrend,
} from "@/lib/validations/gong-call";

// Types for aggregated context
export interface AggregatedContact {
  firstName: string;
  lastName: string;
  title?: string | null;
  role: string;
  sentiment: string;
  // Enrichment fields
  linkedinUrl?: string | null;
  bio?: string | null;
  seniority?: string | null;
  company?: string | null;
}

export interface AggregatedMeeting {
  id: string;
  title: string;
  date: string;
  type: "gong" | "granola" | "google";
  painPoints?: string[];
  goals?: string[];
  nextSteps?: string[];
  whyAndWhyNow?: string[];
  quantifiableMetrics?: string[];
  transcriptSummary?: string;
  // Enhanced extraction fields
  keyQuotes?: string[];
  objections?: string[];
  competitionMentions?: CompetitionMention[];
  decisionProcess?: DecisionProcess | null;
  callSentiment?: CallSentiment | null;
}

export interface RiskAssessment {
  budget?: { level: string; evidence: string[] };
  timeline?: { level: string; evidence: string[] };
  competition?: { level: string; evidence: string[] };
  technical?: { level: string; evidence: string[] };
  alignment?: { level: string; evidence: string[] };
  resistance?: { level: string; evidence: string[] };
}

export interface ConsolidatedInsights {
  painPoints: string[];
  goals: string[];
  whyAndWhyNow: string[];
  quantifiableMetrics: string[];
  riskAssessment?: RiskAssessment | null;
  // Enhanced consolidated fields
  keyQuotes?: string[];
  objections?: string[];
  competitionSummary?: ConsolidatedCompetition | null;
  decisionProcessSummary?: ConsolidatedDecisionProcess | null;
  sentimentTrend?: ConsolidatedSentimentTrend | null;
}

export interface AggregatedReferenceDocument {
  id: string;
  title: string;
  category: string;
  content: string;
}

export interface AggregatedContext {
  opportunity: {
    id: string;
    name: string;
    amountArr: number;
    stage: string;
    confidenceLevel: number;
    closeDate?: string;
    competition?: string | null;
    platformType?: string | null;
    nextStep?: string | null;
    notes?: string | null;
  };
  account?: {
    name: string;
    industry?: string | null;
    website?: string | null;
    ticker?: string | null;
  } | null;
  contacts: AggregatedContact[];
  consolidatedInsights?: ConsolidatedInsights | null;
  meetings: AggregatedMeeting[];
  accountResearch?: string | null;
  additionalContext?: string;
  referenceDocuments?: AggregatedReferenceDocument[];
}

/**
 * Aggregates all selected context sources for content generation
 */
export async function aggregateContext(
  opportunityId: string,
  selection: ContextSelectionInput
): Promise<AggregatedContext> {
  // Fetch opportunity with related data
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      account: true,
      contacts: true,
    },
  });

  if (!opportunity) {
    throw new Error("Opportunity not found");
  }

  // Build base context
  const context: AggregatedContext = {
    opportunity: {
      id: opportunity.id,
      name: opportunity.name,
      amountArr: opportunity.amountArr,
      stage: opportunity.stage,
      confidenceLevel: opportunity.confidenceLevel,
      closeDate: opportunity.closeDate
        ? formatDateShort(opportunity.closeDate)
        : undefined,
      competition: opportunity.competition,
      platformType: opportunity.platformType,
      nextStep: opportunity.nextStep,
      notes: opportunity.notes,
    },
    account: opportunity.account
      ? {
          name: opportunity.account.name,
          industry: opportunity.account.industry,
          website: opportunity.account.website,
          ticker: opportunity.account.ticker,
        }
      : null,
    contacts: opportunity.contacts.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      title: c.title,
      role: c.role,
      sentiment: c.sentiment,
      // Enrichment fields
      linkedinUrl: c.linkedinUrl,
      bio: c.bio,
      seniority: c.seniority,
      company: c.company,
    })),
    meetings: [],
  };

  // Add consolidated insights if requested
  if (selection.includeConsolidatedInsights) {
    context.consolidatedInsights = {
      painPoints: (opportunity.consolidatedPainPoints as string[]) || [],
      goals: (opportunity.consolidatedGoals as string[]) || [],
      whyAndWhyNow: (opportunity.consolidatedWhyAndWhyNow as string[]) || [],
      quantifiableMetrics: (opportunity.consolidatedMetrics as string[]) || [],
      riskAssessment: opportunity.consolidatedRiskAssessment as RiskAssessment | null,
      // Enhanced consolidated fields
      keyQuotes: (opportunity.consolidatedKeyQuotes as string[]) || [],
      objections: (opportunity.consolidatedObjections as string[]) || [],
      competitionSummary: opportunity.consolidatedCompetition as ConsolidatedCompetition | null,
      decisionProcessSummary: opportunity.consolidatedDecisionProcess as ConsolidatedDecisionProcess | null,
      sentimentTrend: opportunity.consolidatedSentimentTrend as ConsolidatedSentimentTrend | null,
    };
  }

  // Add account research if requested
  if (selection.includeAccountResearch && opportunity.accountResearch) {
    context.accountResearch = opportunity.accountResearch;
  }

  // Fetch selected Gong calls
  if (selection.gongCallIds && selection.gongCallIds.length > 0) {
    const gongCalls = await prisma.gongCall.findMany({
      where: {
        id: { in: selection.gongCallIds },
        opportunityId: opportunityId,
      },
      orderBy: { meetingDate: "asc" },
    });

    for (const call of gongCalls) {
      context.meetings.push({
        id: call.id,
        title: call.title,
        date: formatDateShort(call.meetingDate),
        type: "gong",
        painPoints: (call.painPoints as string[]) || undefined,
        goals: (call.goals as string[]) || undefined,
        nextSteps: (call.nextSteps as string[]) || undefined,
        whyAndWhyNow: (call.whyAndWhyNow as string[]) || undefined,
        quantifiableMetrics: (call.quantifiableMetrics as string[]) || undefined,
        // Only include full transcript if explicitly requested
        transcriptSummary:
          selection.includeMeetingTranscripts && call.transcriptText
            ? truncateText(call.transcriptText, 115000)
            : undefined,
        // Enhanced extraction fields
        keyQuotes: (call.keyQuotes as string[]) || undefined,
        objections: (call.objections as string[]) || undefined,
        competitionMentions: (call.competitionMentions as CompetitionMention[]) || undefined,
        decisionProcess: (call.decisionProcess as DecisionProcess) || null,
        callSentiment: (call.callSentiment as CallSentiment) || null,
      });
    }
  }

  // Fetch selected Granola notes
  if (selection.granolaNoteIds && selection.granolaNoteIds.length > 0) {
    const granolaNotes = await prisma.granolaNote.findMany({
      where: {
        id: { in: selection.granolaNoteIds },
        opportunityId: opportunityId,
      },
      orderBy: { meetingDate: "asc" },
    });

    for (const note of granolaNotes) {
      context.meetings.push({
        id: note.id,
        title: note.title,
        date: formatDateShort(note.meetingDate),
        type: "granola",
        painPoints: (note.painPoints as string[]) || undefined,
        goals: (note.goals as string[]) || undefined,
        nextSteps: (note.nextSteps as string[]) || undefined,
        whyAndWhyNow: (note.whyAndWhyNow as string[]) || undefined,
        quantifiableMetrics: (note.quantifiableMetrics as string[]) || undefined,
        // Only include full transcript if explicitly requested
        transcriptSummary:
          selection.includeMeetingTranscripts && note.transcriptText
            ? truncateText(note.transcriptText, 115000)
            : undefined,
        // Enhanced extraction fields
        keyQuotes: (note.keyQuotes as string[]) || undefined,
        objections: (note.objections as string[]) || undefined,
        competitionMentions: (note.competitionMentions as CompetitionMention[]) || undefined,
        decisionProcess: (note.decisionProcess as DecisionProcess) || null,
        callSentiment: (note.callSentiment as CallSentiment) || null,
      });
    }
  }

  // Fetch selected Google notes
  if (selection.googleNoteIds && selection.googleNoteIds.length > 0) {
    const googleNotes = await prisma.googleNote.findMany({
      where: {
        id: { in: selection.googleNoteIds },
        opportunityId: opportunityId,
      },
      orderBy: { createdAt: "asc" },
    });

    for (const note of googleNotes) {
      context.meetings.push({
        id: note.id,
        title: note.title,
        date: formatDateShort(note.createdAt),
        type: "google",
      });
    }
  }

  // Sort meetings by date
  context.meetings.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Add additional context
  if (selection.additionalContext) {
    context.additionalContext = selection.additionalContext;
  }

  // Initialize referenceDocuments array
  context.referenceDocuments = [];

  // Fetch reference documents (opportunity-level)
  if (selection.referenceDocumentIds && selection.referenceDocumentIds.length > 0) {
    const documents = await prisma.document.findMany({
      where: {
        id: { in: selection.referenceDocumentIds },
        opportunityId: opportunityId,
      },
      select: {
        id: true,
        title: true,
        category: true,
        content: true,
      },
    });

    const docRefs = documents
      .filter((doc) => doc.content) // Only include documents with content
      .map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
        content: truncateText(doc.content!, 10000), // Limit content length
      }));

    context.referenceDocuments.push(...docRefs);
  }

  // Fetch reference content items (org-level Content library)
  if (selection.referenceContentIds && selection.referenceContentIds.length > 0) {
    const contents = await prisma.content.findMany({
      where: {
        id: { in: selection.referenceContentIds },
        organizationId: opportunity.organizationId, // Ensure org-level access
      },
      select: {
        id: true,
        title: true,
        contentType: true,
        body: true,
      },
    });

    const contentRefs = contents
      .filter((content) => content.body) // Only include contents with body
      .map((content) => ({
        id: content.id,
        title: content.title,
        category: content.contentType, // Map contentType to category for consistency
        content: truncateText(content.body!, 10000), // Limit content length
      }));

    context.referenceDocuments.push(...contentRefs);
  }

  // Clean up empty array
  if (context.referenceDocuments.length === 0) {
    delete context.referenceDocuments;
  }

  return context;
}

/**
 * Truncates text to a maximum length, preserving word boundaries
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}

/**
 * Formats aggregated context into a prompt string for AI generation
 */
export function formatContextForPrompt(context: AggregatedContext): string {
  const sections: string[] = [];

  // Opportunity info
  sections.push(`## Opportunity Details
- **Name:** ${context.opportunity.name}
- **ARR:** $${context.opportunity.amountArr.toLocaleString()}
- **Stage:** ${context.opportunity.stage}
- **Confidence Level:** ${context.opportunity.confidenceLevel}/5
${context.opportunity.closeDate ? `- **Close Date:** ${context.opportunity.closeDate}` : ""}
${context.opportunity.competition ? `- **Competition:** ${context.opportunity.competition}` : ""}
${context.opportunity.platformType ? `- **Platform Type:** ${context.opportunity.platformType}` : ""}
${context.opportunity.nextStep ? `- **Next Steps:** ${context.opportunity.nextStep}` : ""}`);

  // Account info
  if (context.account) {
    sections.push(`## Account Information
- **Company:** ${context.account.name}
${context.account.industry ? `- **Industry:** ${context.account.industry}` : ""}
${context.account.website ? `- **Website:** ${context.account.website}` : ""}
${context.account.ticker ? `- **Ticker:** ${context.account.ticker}` : ""}`);
  }

  // Contacts
  if (context.contacts.length > 0) {
    const contactList = context.contacts
      .map((c) => {
        const parts = [`- **${c.firstName} ${c.lastName}**`];
        if (c.title) parts.push(`(${c.title})`);
        parts.push(`- ${c.role}, Sentiment: ${c.sentiment}`);
        // Include enrichment data if available
        if (c.seniority) parts.push(`Seniority: ${c.seniority}`);
        if (c.company) parts.push(`Company: ${c.company}`);
        if (c.bio) parts.push(`\n  Bio: ${c.bio}`);
        if (c.linkedinUrl) parts.push(`\n  LinkedIn: ${c.linkedinUrl}`);
        return parts.join(" ");
      })
      .join("\n");
    sections.push(`## Key Contacts\n${contactList}`);
  }

  // Consolidated insights
  if (context.consolidatedInsights) {
    const insights = context.consolidatedInsights;
    const insightParts: string[] = [];

    if (insights.painPoints.length > 0) {
      insightParts.push(`### Pain Points\n${insights.painPoints.map((p) => `- ${p}`).join("\n")}`);
    }
    if (insights.goals.length > 0) {
      insightParts.push(`### Customer Goals\n${insights.goals.map((g) => `- ${g}`).join("\n")}`);
    }
    if (insights.whyAndWhyNow.length > 0) {
      insightParts.push(`### Why & Why Now\n${insights.whyAndWhyNow.map((w) => `- ${w}`).join("\n")}`);
    }
    if (insights.quantifiableMetrics.length > 0) {
      insightParts.push(`### Quantifiable Metrics\n${insights.quantifiableMetrics.map((m) => `- ${m}`).join("\n")}`);
    }
    // Enhanced consolidated fields
    if (insights.keyQuotes && insights.keyQuotes.length > 0) {
      insightParts.push(`### Key Customer Quotes\n${insights.keyQuotes.map((q) => `- "${q}"`).join("\n")}`);
    }
    if (insights.objections && insights.objections.length > 0) {
      insightParts.push(`### Objections & Concerns\n${insights.objections.map((o) => `- ${o}`).join("\n")}`);
    }
    if (insights.competitionSummary) {
      const comp = insights.competitionSummary;
      const compParts = [];
      if (comp.competitors.length > 0) {
        compParts.push(`- **Competitors:** ${comp.competitors.join(", ")}`);
      }
      if (comp.primaryThreat) {
        compParts.push(`- **Primary Threat:** ${comp.primaryThreat}`);
      }
      if (comp.customerSentiment) {
        compParts.push(`- **Customer Sentiment:** ${comp.customerSentiment}`);
      }
      if (compParts.length > 0) {
        insightParts.push(`### Competitive Landscape\n${compParts.join("\n")}`);
      }
    }
    if (insights.decisionProcessSummary) {
      const dec = insights.decisionProcessSummary;
      const decParts = [];
      if (dec.timeline) {
        decParts.push(`- **Timeline:** ${dec.timeline}`);
      }
      if (dec.keyStakeholders.length > 0) {
        decParts.push(`- **Key Stakeholders:** ${dec.keyStakeholders.join(", ")}`);
      }
      if (dec.budgetStatus) {
        decParts.push(`- **Budget Status:** ${dec.budgetStatus}`);
      }
      if (dec.remainingSteps.length > 0) {
        decParts.push(`- **Remaining Steps:** ${dec.remainingSteps.join("; ")}`);
      }
      if (decParts.length > 0) {
        insightParts.push(`### Decision Process\n${decParts.join("\n")}`);
      }
    }
    if (insights.sentimentTrend) {
      const sent = insights.sentimentTrend;
      insightParts.push(`### Sentiment Trend\n- **Trajectory:** ${sent.trajectory}\n- **Current State:** ${sent.currentState}\n- **Summary:** ${sent.summary}`);
    }

    if (insightParts.length > 0) {
      sections.push(`## Consolidated Call Insights\n${insightParts.join("\n\n")}`);
    }
  }

  // Meeting details
  if (context.meetings.length > 0) {
    const meetingDetails = context.meetings.map((m) => {
      const parts = [`### ${m.title} (${m.date}) - ${m.type.toUpperCase()}`];

      if (m.painPoints && m.painPoints.length > 0) {
        parts.push(`**Pain Points:** ${m.painPoints.join("; ")}`);
      }
      if (m.goals && m.goals.length > 0) {
        parts.push(`**Goals:** ${m.goals.join("; ")}`);
      }
      if (m.nextSteps && m.nextSteps.length > 0) {
        parts.push(`**Next Steps:** ${m.nextSteps.join("; ")}`);
      }
      // Enhanced extraction fields
      if (m.keyQuotes && m.keyQuotes.length > 0) {
        parts.push(`**Key Quotes:** ${m.keyQuotes.map((q) => `"${q}"`).join("; ")}`);
      }
      if (m.objections && m.objections.length > 0) {
        parts.push(`**Objections:** ${m.objections.join("; ")}`);
      }
      if (m.competitionMentions && m.competitionMentions.length > 0) {
        const compStr = m.competitionMentions
          .map((c) => `${c.competitor} (${c.sentiment}): ${c.context}`)
          .join("; ");
        parts.push(`**Competition Mentions:** ${compStr}`);
      }
      if (m.decisionProcess) {
        const dec = m.decisionProcess;
        const decParts = [];
        if (dec.timeline) decParts.push(`Timeline: ${dec.timeline}`);
        if (dec.stakeholders.length > 0) decParts.push(`Stakeholders: ${dec.stakeholders.join(", ")}`);
        if (dec.budgetContext) decParts.push(`Budget: ${dec.budgetContext}`);
        if (decParts.length > 0) {
          parts.push(`**Decision Process:** ${decParts.join("; ")}`);
        }
      }
      if (m.callSentiment) {
        parts.push(`**Sentiment:** ${m.callSentiment.overall} (Momentum: ${m.callSentiment.momentum}, Enthusiasm: ${m.callSentiment.enthusiasm})`);
      }
      if (m.transcriptSummary) {
        parts.push(`**Transcript Summary:** ${m.transcriptSummary}`);
      }

      return parts.join("\n");
    });

    sections.push(`## Meeting Notes\n${meetingDetails.join("\n\n")}`);
  }

  // Account research
  if (context.accountResearch) {
    sections.push(`## Account Research\n${context.accountResearch}`);
  }

  // Additional context
  if (context.additionalContext) {
    sections.push(`## Additional Context from User\n${context.additionalContext}`);
  }

  return sections.join("\n\n---\n\n");
}
