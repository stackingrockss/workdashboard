import { prisma } from "@/lib/db";
import type { RiskAssessment } from "@/lib/validations/gong-call";

// Re-use the same helper functions from gong-history
import {
  formatDateUS,
  parseHistoryString,
  formatHistoryEntries,
} from "./gong-history";

/**
 * Format a RiskAssessment object into an array of strings suitable for history
 *
 * Output format:
 * - Risk Level: HIGH
 * - [Budget - High] Customer expressed concern about pricing: "quote from transcript"
 * - [Timeline - Medium] Decision delayed: "another quote"
 */
export function formatRiskForHistory(riskAssessment: RiskAssessment): string[] {
  const items: string[] = [];

  // Add risk level as first item
  items.push(`Risk Level: ${riskAssessment.riskLevel.toUpperCase()}`);

  // Add each risk factor as a bullet point
  for (const factor of riskAssessment.riskFactors) {
    // Capitalize first letter of category and severity
    const category =
      factor.category.charAt(0).toUpperCase() + factor.category.slice(1);
    const severity =
      factor.severity.charAt(0).toUpperCase() + factor.severity.slice(1);

    // Format: [Category - Severity] Description: "evidence"
    items.push(
      `[${category} - ${severity}] ${factor.description}: "${factor.evidence}"`
    );
  }

  return items;
}

/**
 * Add or update history entry for a specific meeting date
 * Returns the updated history string
 */
function updateHistoryForDate(
  existingHistory: string | null | undefined,
  meetingDate: string, // MM/DD/YYYY format
  newItems: string[]
): string {
  // Parse existing history
  const { manualNotes, entries } = parseHistoryString(existingHistory);

  // Check if entry for this date already exists
  const existingIndex = entries.findIndex((e) => e.date === meetingDate);

  if (existingIndex >= 0) {
    // Replace existing entry
    entries[existingIndex] = { date: meetingDate, items: newItems };
  } else {
    // Add new entry
    entries.push({ date: meetingDate, items: newItems });
  }

  // Sort by date (newest first)
  entries.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });

  // Rebuild formatted string
  return formatHistoryEntries(manualNotes, entries);
}

/**
 * Append risk assessment to opportunity history for a Gong call
 * Uses parsedGongCallIds to prevent duplicate entries
 */
export async function appendRiskToOpportunityHistory({
  opportunityId,
  gongCallId,
  meetingDate,
  riskAssessment,
}: {
  opportunityId: string;
  gongCallId: string;
  meetingDate: Date | string;
  riskAssessment: RiskAssessment;
}) {
  // Format meeting date to US format
  const formattedDate = formatDateUS(meetingDate);

  // Fetch current opportunity
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      riskAssessmentHistory: true,
      parsedGongCallIds: true,
    },
  });

  if (!opportunity) {
    throw new Error(`Opportunity not found: ${opportunityId}`);
  }

  // Check if this call has already been parsed for risk
  // Note: We reuse parsedGongCallIds since risk analysis happens after parsing
  // and we only want one risk entry per call
  if (opportunity.parsedGongCallIds.includes(gongCallId)) {
    console.log(
      `[risk-history] Call ${gongCallId} already processed for opportunity ${opportunityId}, skipping duplicate`
    );
    return opportunity;
  }

  // Format risk assessment into history items
  const riskItems = formatRiskForHistory(riskAssessment);

  // Update history
  const updatedRiskHistory = updateHistoryForDate(
    opportunity.riskAssessmentHistory,
    formattedDate,
    riskItems
  );

  // Save to database (don't update parsedGongCallIds - that's done by the parsing job)
  const updatedOpportunity = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      riskAssessmentHistory: updatedRiskHistory,
    },
  });

  console.log(
    `[risk-history] Successfully updated opportunity ${opportunityId} with risk assessment from Gong call ${gongCallId}`
  );

  return updatedOpportunity;
}

/**
 * Append risk assessment to opportunity history for a Granola note
 * Uses parsedGranolaIds to prevent duplicate entries
 */
export async function appendRiskToGranolaHistory({
  opportunityId,
  granolaId,
  meetingDate,
  riskAssessment,
}: {
  opportunityId: string;
  granolaId: string;
  meetingDate: Date | string;
  riskAssessment: RiskAssessment;
}) {
  // Format meeting date to US format
  const formattedDate = formatDateUS(meetingDate);

  // Fetch current opportunity
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      riskAssessmentHistory: true,
      parsedGranolaIds: true,
    },
  });

  if (!opportunity) {
    throw new Error(`Opportunity not found: ${opportunityId}`);
  }

  // Check if this note has already been processed for risk
  if (opportunity.parsedGranolaIds.includes(granolaId)) {
    console.log(
      `[risk-history] Note ${granolaId} already processed for opportunity ${opportunityId}, skipping duplicate`
    );
    return opportunity;
  }

  // Format risk assessment into history items
  const riskItems = formatRiskForHistory(riskAssessment);

  // Update history
  const updatedRiskHistory = updateHistoryForDate(
    opportunity.riskAssessmentHistory,
    formattedDate,
    riskItems
  );

  // Save to database (don't update parsedGranolaIds - that's done by the parsing job)
  const updatedOpportunity = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      riskAssessmentHistory: updatedRiskHistory,
    },
  });

  console.log(
    `[risk-history] Successfully updated opportunity ${opportunityId} with risk assessment from Granola note ${granolaId}`
  );

  return updatedOpportunity;
}
