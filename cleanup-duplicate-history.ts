// One-time script to remove duplicate entries in Call Insights history
import { PrismaClient } from '@prisma/client';
import { parseHistoryString, formatHistoryEntries } from './src/lib/utils/gong-history';

const prisma = new PrismaClient();

interface HistoryEntry {
  date: string;
  items: string[];
}

/**
 * Deduplicates entries with the same date in auto-generated section
 * If multiple entries exist for the same date, keeps only the first one
 */
function deduplicateEntries(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  const deduped: HistoryEntry[] = [];

  for (const entry of entries) {
    if (!seen.has(entry.date)) {
      seen.add(entry.date);
      deduped.push(entry);
    } else {
      console.log(`  - Removing duplicate entry for date: ${entry.date}`);
    }
  }

  return deduped;
}

/**
 * Clean up history field by removing duplicate date entries
 */
function cleanupHistory(historyText: string | null | undefined): string | null {
  if (!historyText || historyText.trim() === '') {
    return historyText || null;
  }

  const { manualNotes, entries } = parseHistoryString(historyText);

  // Deduplicate entries
  const dedupedEntries = deduplicateEntries(entries);

  // If nothing changed, return original
  if (dedupedEntries.length === entries.length) {
    return historyText;
  }

  // Rebuild with deduplicated entries
  return formatHistoryEntries(manualNotes, dedupedEntries);
}

async function cleanupAllOpportunities() {
  console.log('Starting cleanup of duplicate Call Insights history...\n');

  // Get all opportunities with history fields
  const opportunities = await prisma.opportunity.findMany({
    where: {
      OR: [
        { painPointsHistory: { not: null } },
        { goalsHistory: { not: null } },
        { nextStepsHistory: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      painPointsHistory: true,
      goalsHistory: true,
      nextStepsHistory: true,
    },
  });

  console.log(`Found ${opportunities.length} opportunities with history fields\n`);

  let updatedCount = 0;

  for (const opp of opportunities) {
    console.log(`\nProcessing: ${opp.name} (${opp.id})`);

    const cleanedPainPoints = cleanupHistory(opp.painPointsHistory);
    const cleanedGoals = cleanupHistory(opp.goalsHistory);
    const cleanedNextSteps = cleanupHistory(opp.nextStepsHistory);

    const hasChanges =
      cleanedPainPoints !== opp.painPointsHistory ||
      cleanedGoals !== opp.goalsHistory ||
      cleanedNextSteps !== opp.nextStepsHistory;

    if (hasChanges) {
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: {
          painPointsHistory: cleanedPainPoints,
          goalsHistory: cleanedGoals,
          nextStepsHistory: cleanedNextSteps,
        },
      });

      updatedCount++;
      console.log(`  ✅ Cleaned up duplicates`);
    } else {
      console.log(`  ✓ No duplicates found`);
    }
  }

  console.log(`\n✅ Cleanup complete!`);
  console.log(`Updated ${updatedCount} of ${opportunities.length} opportunities`);

  await prisma.$disconnect();
}

cleanupAllOpportunities().catch((error) => {
  console.error('Error during cleanup:', error);
  process.exit(1);
});
