/**
 * Run SQL migration for ForecastCategory enum
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Running SQL migration for ForecastCategory enum...\n");

  try {
    // Read the SQL file
    const sqlPath = join(process.cwd(), "scripts", "migrate-forecast-enum.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    // Split into individual statements (remove BEGIN/COMMIT for raw execution)
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--") && s !== "BEGIN" && s !== "COMMIT");

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);

      await prisma.$executeRawUnsafe(statement);

      console.log(`✓ Completed\n`);
    }

    console.log("✅ Migration completed successfully!");
    console.log("\nNext step: Run `npx prisma generate` to update the Prisma client.");
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
