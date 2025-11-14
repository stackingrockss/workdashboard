/**
 * Verify ForecastCategory enum values in database
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking ForecastCategory enum values in database...\n");

  const result = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
    SELECT enumlabel
    FROM pg_enum
    WHERE enumtypid = (
      SELECT oid
      FROM pg_type
      WHERE typname = 'ForecastCategory'
      AND typnamespace = (
        SELECT oid
        FROM pg_namespace
        WHERE nspname = 'opportunity_tracker'
      )
    )
  `;

  console.log("Current enum values:");
  result.forEach((row) => {
    console.log(`  - ${row.enumlabel}`);
  });

  // Also check how many opportunities use each category
  console.log("\nOpportunities by forecast category:");
  const counts = await prisma.$queryRaw<
    Array<{ forecastCategory: string | null; count: bigint }>
  >`
    SELECT "forecastCategory", COUNT(*) as count
    FROM "opportunity_tracker"."Opportunity"
    GROUP BY "forecastCategory"
    ORDER BY "forecastCategory"
  `;

  counts.forEach((row) => {
    console.log(`  ${row.forecastCategory || "NULL"}: ${row.count}`);
  });
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
