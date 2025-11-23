// scripts/backfill-risk-prod.ts
// Backfill missing risk assessments in production database
// This script connects directly to production DB and triggers API calls to your production URL

import { PrismaClient } from "@prisma/client";

// Use production database URL
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL environment variable not set");
  console.error("Make sure your .env.local has the production DATABASE_URL");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

// Production URL - update this to your Vercel deployment URL
const PROD_URL = process.env.PROD_URL || "https://your-app.vercel.app";

async function main() {
  console.log("🔍 Connecting to production database...");
  console.log(`📍 Production API: ${PROD_URL}\n`);

  // Verify connection
  try {
    await prisma.$connect();
    console.log("✅ Connected to database\n");
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  }

  console.log("🔍 Finding Gong calls without risk assessments...\n");

  // Get all completed calls (Prisma JSON null checks are quirky)
  const allCompletedCalls = await prisma.gongCall.findMany({
    where: {
      parsingStatus: "completed",
    },
    select: {
      id: true,
      title: true,
      parsedAt: true,
      transcriptText: true,
      riskAssessment: true,
      opportunity: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      parsedAt: "desc",
    },
  });

  // Filter for calls without risk assessment
  const callsNeedingRisk = allCompletedCalls.filter((call) => !call.riskAssessment || call.riskAssessment === null);

  if (callsNeedingRisk.length === 0) {
    console.log("✅ All completed calls already have risk assessments!");
    return;
  }

  console.log(`Found ${callsNeedingRisk.length} calls missing risk assessments\n`);
  console.log("=".repeat(80));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < callsNeedingRisk.length; i++) {
    const call = callsNeedingRisk[i];
    const progress = `[${i + 1}/${callsNeedingRisk.length}]`;

    console.log(`\n${progress} ${call.title}`);
    console.log(`   Opportunity: ${call.opportunity.name}`);
    console.log(`   Call ID: ${call.id}`);
    console.log(`   Transcript length: ${call.transcriptText?.length || 0} chars`);

    if (!call.transcriptText) {
      console.log(`   ⚠️  Skipping: No transcript text available`);
      failCount++;
      continue;
    }

    try {
      console.log(`   🔄 Triggering risk analysis...`);

      const response = await fetch(`${PROD_URL}/api/v1/gong-calls/${call.id}/analyze-risk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error || error.details || errorText;
        } catch {
          errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const riskLevel = result.riskAssessment?.riskLevel || "N/A";
      const factorsCount = result.riskAssessment?.riskFactors?.length || 0;

      console.log(`   ✅ Success! Risk Level: ${riskLevel.toUpperCase()}, Factors: ${factorsCount}`);
      successCount++;

      // Add delay to avoid rate limiting (especially important for Gemini API)
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      failCount++;

      // If we hit rate limits, wait longer
      if (error instanceof Error && error.message.includes("429")) {
        console.log(`   ⏳ Rate limited, waiting 10 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Backfill complete!");
  console.log(`   Success: ${successCount}/${callsNeedingRisk.length}`);
  console.log(`   Failed: ${failCount}/${callsNeedingRisk.length}`);

  if (successCount > 0) {
    console.log(`\n💡 Run this script again or check-gong-risk-status.ts to verify`);
  }
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
