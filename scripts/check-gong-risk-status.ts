// scripts/check-gong-risk-status.ts
// Check Gong calls with completed parsing but missing risk assessments

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking Gong calls for risk assessment status...\n");

  const calls = await prisma.gongCall.findMany({
    where: {
      parsingStatus: "completed",
    },
    select: {
      id: true,
      title: true,
      parsingStatus: true,
      parsedAt: true,
      riskAssessment: true,
      createdAt: true,
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
    take: 20,
  });

  console.log(`Found ${calls.length} completed Gong calls\n`);

  const callsWithoutRisk = calls.filter((call) => !call.riskAssessment);
  const callsWithRisk = calls.filter((call) => call.riskAssessment);

  console.log("📊 Summary:");
  console.log(`  ✅ Calls with risk assessment: ${callsWithRisk.length}`);
  console.log(`  ❌ Calls without risk assessment: ${callsWithoutRisk.length}\n`);

  if (callsWithoutRisk.length > 0) {
    console.log("❌ Calls missing risk assessment:");
    console.log("=".repeat(80));
    callsWithoutRisk.forEach((call, index) => {
      console.log(`\n${index + 1}. ${call.title}`);
      console.log(`   ID: ${call.id}`);
      console.log(`   Opportunity: ${call.opportunity.name} (${call.opportunity.id})`);
      console.log(`   Parsed: ${call.parsedAt?.toISOString() || "N/A"}`);
      console.log(`   Created: ${call.createdAt.toISOString()}`);
    });
    console.log("\n" + "=".repeat(80));
    console.log(`\n💡 To manually trigger risk analysis for these calls:`);
    console.log(`   curl -X POST http://localhost:3000/api/v1/gong-calls/{id}/analyze-risk\n`);
  }

  if (callsWithRisk.length > 0) {
    console.log("\n✅ Sample calls with risk assessment:");
    console.log("=".repeat(80));
    callsWithRisk.slice(0, 3).forEach((call, index) => {
      console.log(`\n${index + 1}. ${call.title}`);
      console.log(`   ID: ${call.id}`);
      console.log(`   Risk Level: ${(call.riskAssessment as any)?.riskLevel || "N/A"}`);
    });
  }
}

main()
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
