/**
 * Utility functions for converting consolidated insights to markdown format
 * and merging them into the notes field
 */

import { formatDateShort } from "@/lib/format";
import type { RiskAssessment } from "@/types/gong-call";

// ============================================================================
// Types
// ============================================================================

export interface ConsolidatedInsightsData {
  painPoints: string[];
  goals: string[];
  riskAssessment: RiskAssessment | null;
  whyAndWhyNow: string[];
  quantifiableMetrics: string[];
  lastConsolidatedAt: string | Date;
  consolidationCallCount: number;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Convert consolidated insights JSON to formatted markdown
 * Creates a structured, editable format for the RTF notes editor
 */
export function insightsToMarkdown(data: ConsolidatedInsightsData): string {
  const sections: string[] = [];

  // Format the date
  const formattedDate = formatDateShort(
    typeof data.lastConsolidatedAt === "string"
      ? data.lastConsolidatedAt
      : data.lastConsolidatedAt.toISOString()
  );

  // Header with metadata
  sections.push(
    `> **AI Call Insights** | Updated: ${formattedDate} | ${data.consolidationCallCount} call${data.consolidationCallCount !== 1 ? "s" : ""}\n`
  );

  // Pain Points
  if (data.painPoints && data.painPoints.length > 0) {
    sections.push(`## Pain Points\n${data.painPoints.map(p => `- ${p}`).join("\n")}\n`);
  }

  // Goals
  if (data.goals && data.goals.length > 0) {
    sections.push(`## Goals\n${data.goals.map(g => `- ${g}`).join("\n")}\n`);
  }

  // Risk Assessment
  if (data.riskAssessment) {
    const ra = data.riskAssessment;
    let riskSection = `## Risk Assessment\n**Risk Level:** ${ra.riskLevel.toUpperCase()}\n\n${ra.overallSummary}\n`;

    if (ra.riskFactors && ra.riskFactors.length > 0) {
      riskSection += `\n### Risk Factors\n`;
      ra.riskFactors.forEach(rf => {
        riskSection += `- **${capitalize(rf.category)} (${capitalize(rf.severity)}):** ${rf.description}\n`;
      });
    }
    sections.push(riskSection);
  }

  // Why & Why Now
  if (data.whyAndWhyNow && data.whyAndWhyNow.length > 0) {
    sections.push(`## Why & Why Now\n${data.whyAndWhyNow.map(w => `- ${w}`).join("\n")}\n`);
  }

  // Quantifiable Metrics
  if (data.quantifiableMetrics && data.quantifiableMetrics.length > 0) {
    sections.push(`## Metrics\n${data.quantifiableMetrics.map(m => `- ${m}`).join("\n")}\n`);
  }

  return sections.join("\n");
}

/**
 * Merge new insights markdown into existing notes
 * Prepends new insights to preserve all user content
 */
export function mergeInsightsIntoNotes(
  newInsights: string,
  existingNotes: string | null | undefined
): string {
  const SEPARATOR = "\n---\n\n";

  if (!existingNotes || existingNotes.trim() === "") {
    // Empty notes - add insights with separator for future user notes
    return newInsights + SEPARATOR;
  }

  // Prepend new insights to existing content
  // This preserves everything the user has written
  return newInsights + SEPARATOR + existingNotes;
}

/**
 * Check if notes content appears to contain AI-generated insights
 * Used to determine if we should show "Add Insights" vs "Refresh Insights" button
 */
export function notesContainInsights(notes: string | null | undefined): boolean {
  if (!notes) return false;

  // Check for the AI insights header marker
  return notes.includes("**AI Call Insights**") ||
         notes.includes("## Pain Points") ||
         notes.includes("## Goals") ||
         notes.includes("## Risk Assessment");
}

/**
 * Check if opportunity has consolidated insights available
 */
export function hasConsolidatedInsights(opportunity: {
  consolidatedPainPoints?: unknown;
  consolidatedGoals?: unknown;
  lastConsolidatedAt?: Date | string | null;
  consolidationCallCount?: number | null;
}): boolean {
  return Boolean(
    opportunity.consolidatedPainPoints &&
    opportunity.consolidatedGoals &&
    opportunity.lastConsolidatedAt &&
    opportunity.consolidationCallCount &&
    opportunity.consolidationCallCount > 0
  );
}

/**
 * Extract consolidated insights data from opportunity object
 */
export function extractInsightsData(opportunity: {
  consolidatedPainPoints?: unknown;
  consolidatedGoals?: unknown;
  consolidatedRiskAssessment?: RiskAssessment | null;
  consolidatedWhyAndWhyNow?: unknown;
  consolidatedMetrics?: unknown;
  lastConsolidatedAt?: Date | string | null;
  consolidationCallCount?: number | null;
}): ConsolidatedInsightsData | null {
  if (!hasConsolidatedInsights(opportunity)) {
    return null;
  }

  return {
    painPoints: (opportunity.consolidatedPainPoints as string[]) || [],
    goals: (opportunity.consolidatedGoals as string[]) || [],
    riskAssessment: opportunity.consolidatedRiskAssessment || null,
    whyAndWhyNow: (opportunity.consolidatedWhyAndWhyNow as string[]) || [],
    quantifiableMetrics: (opportunity.consolidatedMetrics as string[]) || [],
    lastConsolidatedAt: opportunity.lastConsolidatedAt!,
    consolidationCallCount: opportunity.consolidationCallCount!,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
