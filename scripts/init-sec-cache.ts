/**
 * One-time script to populate SEC company cache
 * Run with: npx tsx scripts/init-sec-cache.ts
 */

import { forceRefreshSecCache } from "../src/lib/integrations/sec-edgar-improved";

async function main() {
  console.log("Initializing SEC company cache...");
  console.log("This will fetch ~13,000 companies from SEC and store in database");
  console.log("Expected time: 2-3 minutes");
  console.log("");

  try {
    await forceRefreshSecCache();
    console.log("");
    console.log("✅ SEC cache initialization completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("");
    console.error("❌ Failed to initialize SEC cache:");
    console.error(error);
    process.exit(1);
  }
}

main();
