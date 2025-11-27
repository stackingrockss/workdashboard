import { prisma } from "../src/lib/db";
import { recalculateNextCallDateForOpportunity } from "../src/lib/utils/next-call-date-calculator";

async function backfillNextCallDates() {
  console.log("Starting backfill of next call dates...\n");

  const opportunities = await prisma.opportunity.findMany({
    where: {
      stage: { notIn: ["closedWon", "closedLost"] }, // Only active opportunities
    },
    select: { id: true, name: true },
  });

  console.log(`Found ${opportunities.length} active opportunities to process.\n`);

  let processed = 0;
  let updated = 0;
  let errors = 0;

  for (const opp of opportunities) {
    try {
      const result = await recalculateNextCallDateForOpportunity(opp.id);
      processed++;

      if (result.nextCallDate) {
        updated++;
        console.log(
          `✓ ${opp.name}: ${result.nextCallDate.toISOString()} (${result.source})`
        );
      } else {
        console.log(`  ${opp.name}: No future meetings`);
      }

      if (processed % 100 === 0) {
        console.log(
          `\nProgress: ${processed}/${opportunities.length} processed, ${updated} updated\n`
        );
      }
    } catch (error) {
      errors++;
      console.error(`✗ ${opp.name}: Error -`, error);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("Backfill complete!");
  console.log(`Total processed: ${processed}/${opportunities.length}`);
  console.log(`Opportunities with next call dates: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`${"=".repeat(60)}\n`);
}

backfillNextCallDates()
  .catch((error) => {
    console.error("Fatal error during backfill:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
