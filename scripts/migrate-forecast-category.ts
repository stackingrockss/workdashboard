/**
 * Migration script to update ForecastCategory enum values
 *
 * Step 1: Add new enum values (commit, closedWon, closedLost)
 * Step 2: Migrate existing data from "forecast" to "commit"
 * Step 3: Set forecast categories for opportunities based on stage
 *
 * After this script runs, use `npx prisma db push --accept-data-loss`
 * to remove the old "forecast" enum value.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting ForecastCategory enum migration...");

  try {
    // Step 1: Add new enum values to ForecastCategory
    console.log("\nStep 1: Adding new enum values...");
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "opportunity_tracker"."ForecastCategory" ADD VALUE IF NOT EXISTS 'commit';
    `);
    console.log("  ✓ Added 'commit'");

    await prisma.$executeRawUnsafe(`
      ALTER TYPE "opportunity_tracker"."ForecastCategory" ADD VALUE IF NOT EXISTS 'closedWon';
    `);
    console.log("  ✓ Added 'closedWon'");

    await prisma.$executeRawUnsafe(`
      ALTER TYPE "opportunity_tracker"."ForecastCategory" ADD VALUE IF NOT EXISTS 'closedLost';
    `);
    console.log("  ✓ Added 'closedLost'");

    // Step 2: Check and migrate existing "forecast" values
    console.log("\nStep 2: Migrating existing 'forecast' values to 'commit'...");
    const opportunitiesWithForecast = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "opportunity_tracker"."Opportunity"
      WHERE "forecastCategory" = 'forecast'
    `;

    const count = Number(opportunitiesWithForecast[0]?.count || 0);
    console.log(`  Found ${count} opportunities with forecastCategory = 'forecast'`);

    if (count > 0) {
      const result = await prisma.$executeRaw`
        UPDATE "opportunity_tracker"."Opportunity"
        SET "forecastCategory" = 'commit'::"opportunity_tracker"."ForecastCategory"
        WHERE "forecastCategory" = 'forecast'
      `;

      console.log(`  ✓ Updated ${result} opportunities from 'forecast' to 'commit'`);
    }

    // Step 3: Set forecast categories for opportunities based on their stage
    console.log("\nStep 3: Setting forecast categories based on stage...");

    const updateClosedWon = await prisma.$executeRaw`
      UPDATE "opportunity_tracker"."Opportunity"
      SET "forecastCategory" = 'closedWon'::"opportunity_tracker"."ForecastCategory"
      WHERE stage = 'closedWon' AND "forecastCategory" IS NULL
    `;
    console.log(`  ✓ Updated ${updateClosedWon} closedWon opportunities`);

    const updateClosedLost = await prisma.$executeRaw`
      UPDATE "opportunity_tracker"."Opportunity"
      SET "forecastCategory" = 'closedLost'::"opportunity_tracker"."ForecastCategory"
      WHERE stage = 'closedLost' AND "forecastCategory" IS NULL
    `;
    console.log(`  ✓ Updated ${updateClosedLost} closedLost opportunities`);

    const updateCommit = await prisma.$executeRaw`
      UPDATE "opportunity_tracker"."Opportunity"
      SET "forecastCategory" = 'commit'::"opportunity_tracker"."ForecastCategory"
      WHERE stage IN ('decisionMakerApproval', 'contracting') AND "forecastCategory" IS NULL
    `;
    console.log(`  ✓ Updated ${updateCommit} commit opportunities (decisionMakerApproval, contracting)`);

    const updateBestCase = await prisma.$executeRaw`
      UPDATE "opportunity_tracker"."Opportunity"
      SET "forecastCategory" = 'bestCase'::"opportunity_tracker"."ForecastCategory"
      WHERE stage = 'validateSolution' AND "forecastCategory" IS NULL
    `;
    console.log(`  ✓ Updated ${updateBestCase} bestCase opportunities (validateSolution)`);

    const updatePipeline = await prisma.$executeRaw`
      UPDATE "opportunity_tracker"."Opportunity"
      SET "forecastCategory" = 'pipeline'::"opportunity_tracker"."ForecastCategory"
      WHERE stage IN ('discovery', 'demo') AND "forecastCategory" IS NULL
    `;
    console.log(`  ✓ Updated ${updatePipeline} pipeline opportunities (discovery, demo)`);

    console.log("\n✅ Migration completed successfully!");
    console.log("\nNext step: Run `npx prisma db push --accept-data-loss` to remove the old 'forecast' enum value.");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
