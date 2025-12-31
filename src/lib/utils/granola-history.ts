import { prisma } from "@/lib/db";

// Re-use the same helper functions from gong-history
import { formatDateUS, parseHistoryString, formatHistoryEntries } from "./gong-history";

// Divider line to separate manual notes from auto-generated entries
const AUTO_GENERATED_DIVIDER = "--- Auto-generated from calls ---";

// Date format regex for US format: MM/DD/YYYY
const DATE_REGEX = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;

/**
 * Represents a parsed history entry with date and items
 */
interface HistoryEntry {
  date: string; // MM/DD/YYYY format
  items: string[];
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
 * Main function to append Granola note insights to opportunity history
 * Updates painPointsHistory, goalsHistory, nextStepsHistory, keyQuotesHistory, and objectionsHistory fields
 * Tracks parsed notes to prevent duplicate entries
 */
export async function appendToGranolaHistory({
  opportunityId,
  granolaId,
  meetingDate,
  painPoints = [],
  goals = [],
  nextSteps = [],
  whyAndWhyNow = [],
  quantifiableMetrics = [],
  keyQuotes = [],
  objections = [],
}: {
  opportunityId: string;
  granolaId: string;
  meetingDate: Date | string;
  painPoints?: string[];
  goals?: string[];
  nextSteps?: string[];
  whyAndWhyNow?: string[];
  quantifiableMetrics?: string[];
  keyQuotes?: string[];
  objections?: string[];
}) {
  // Format meeting date to US format
  const formattedDate = formatDateUS(meetingDate);

  // Fetch current opportunity
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      painPointsHistory: true,
      goalsHistory: true,
      nextStepsHistory: true,
      whyAndWhyNowHistory: true,
      quantifiableMetricsHistory: true,
      keyQuotesHistory: true,
      objectionsHistory: true,
      parsedGranolaIds: true,
    },
  });

  if (!opportunity) {
    throw new Error(`Opportunity not found: ${opportunityId}`);
  }

  // Check if this note has already been parsed
  if (opportunity.parsedGranolaIds.includes(granolaId)) {
    console.log(`[granola-history] Note ${granolaId} already parsed for opportunity ${opportunityId}, skipping duplicate`);
    return opportunity; // Return existing opportunity without changes
  }

  // Update each history field
  const updatedPainPointsHistory = updateHistoryForDate(
    opportunity.painPointsHistory,
    formattedDate,
    painPoints
  );

  const updatedGoalsHistory = updateHistoryForDate(
    opportunity.goalsHistory,
    formattedDate,
    goals
  );

  const updatedNextStepsHistory = updateHistoryForDate(
    opportunity.nextStepsHistory,
    formattedDate,
    nextSteps
  );

  const updatedWhyAndWhyNowHistory = updateHistoryForDate(
    opportunity.whyAndWhyNowHistory,
    formattedDate,
    whyAndWhyNow
  );

  const updatedQuantifiableMetricsHistory = updateHistoryForDate(
    opportunity.quantifiableMetricsHistory,
    formattedDate,
    quantifiableMetrics
  );

  const updatedKeyQuotesHistory = updateHistoryForDate(
    opportunity.keyQuotesHistory,
    formattedDate,
    keyQuotes
  );

  const updatedObjectionsHistory = updateHistoryForDate(
    opportunity.objectionsHistory,
    formattedDate,
    objections
  );

  // Save to database and track this parsed note
  const updatedOpportunity = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      painPointsHistory: updatedPainPointsHistory,
      goalsHistory: updatedGoalsHistory,
      nextStepsHistory: updatedNextStepsHistory,
      whyAndWhyNowHistory: updatedWhyAndWhyNowHistory,
      quantifiableMetricsHistory: updatedQuantifiableMetricsHistory,
      keyQuotesHistory: updatedKeyQuotesHistory,
      objectionsHistory: updatedObjectionsHistory,
      parsedGranolaIds: {
        push: granolaId, // Add this note ID to the tracking array
      },
    },
  });

  console.log(`[granola-history] Successfully updated opportunity ${opportunityId} with insights from note ${granolaId}`);

  return updatedOpportunity;
}
