// scripts/backfill-risk-assessments.ts
// Backfill missing risk assessments for completed Gong calls and Granola notes
// This script also populates the riskAssessmentHistory field on opportunities

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function main() {
  console.log("🔍 Finding calls and notes without risk assessments...\n");

  // Get all completed Gong calls and filter in JavaScript (Prisma JSON null checks are quirky)
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

  // Get all completed Granola notes
  const allCompletedNotes = await prisma.granolaNote.findMany({
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

  // Filter for calls/notes without risk assessment
  const callsNeedingRisk = allCompletedCalls.filter((call) => !call.riskAssessment || call.riskAssessment === null);
  const notesNeedingRisk = allCompletedNotes.filter((note) => !note.riskAssessment || note.riskAssessment === null);

  const totalNeedingRisk = callsNeedingRisk.length + notesNeedingRisk.length;

  if (totalNeedingRisk === 0) {
    console.log("✅ All completed calls and notes already have risk assessments!");
    return;
  }

  console.log(`Found ${callsNeedingRisk.length} Gong calls missing risk assessments`);
  console.log(`Found ${notesNeedingRisk.length} Granola notes missing risk assessments`);
  console.log("=".repeat(80));

  // Process Gong calls
  for (let i = 0; i < callsNeedingRisk.length; i++) {
    const call = callsNeedingRisk[i];
    const progress = `[${i + 1}/${callsNeedingRisk.length}]`;

    console.log(`\n📞 ${progress} ${call.title}`);
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

      // Add small delay to avoid rate limiting (Gemini API)
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Process Granola notes
  for (let i = 0; i < notesNeedingRisk.length; i++) {
    const note = notesNeedingRisk[i];
    const progress = `[${i + 1}/${notesNeedingRisk.length}]`;

    console.log(`\n📝 ${progress} ${note.title}`);
    console.log(`   Opportunity: ${note.opportunity.name}`);
    console.log(`   Note ID: ${note.id}`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/granola-notes/${note.id}/analyze-risk`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to trigger risk analysis");
      }

      console.log(`   ✅ Risk analysis triggered (runs async via Inngest)`);

      // Add small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Backfill complete!");
  console.log(`\n💡 Run 'npx tsx scripts/check-gong-risk-status.ts' to verify results`);
  console.log(`💡 Note: Granola notes run async - check Inngest dashboard for progress`);
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
