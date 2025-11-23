// scripts/backfill-risk-assessments.ts
// Backfill missing risk assessments for completed Gong calls

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function main() {
  console.log("🔍 Finding Gong calls without risk assessments...\n");

  // Get all completed calls and filter in JavaScript (Prisma JSON null checks are quirky)
  const allCompletedCalls = await prisma.gongCall.findMany({
    where: {
      parsingStatus: "completed",
    },
    select: {
      id: true,
      title: true,
      parsedAt: true,
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

  for (let i = 0; i < callsNeedingRisk.length; i++) {
    const call = callsNeedingRisk[i];
    const progress = `[${i + 1}/${callsNeedingRisk.length}]`;

    console.log(`\n${progress} ${call.title}`);
    console.log(`   Opportunity: ${call.opportunity.name}`);
    console.log(`   Call ID: ${call.id}`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/gong-calls/${call.id}/analyze-risk`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to trigger risk analysis");
      }

      const result = await response.json();
      console.log(`   ✅ Risk analysis completed: ${result.riskAssessment?.riskLevel || "N/A"}`);

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Backfill complete!");
  console.log(`\n💡 Run 'npx tsx scripts/check-gong-risk-status.ts' to verify results`);
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
