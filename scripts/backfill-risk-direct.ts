// scripts/backfill-risk-direct.ts
// Backfill missing risk assessments directly (no dev server needed)
// This script calls the AI functions directly and updates the database

import { PrismaClient } from "@prisma/client";
import { analyzeCallRisk } from "../src/lib/ai/analyze-call-risk";
import { appendRiskToOpportunityHistory, appendRiskToGranolaHistory } from "../src/lib/utils/risk-assessment-history";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Finding calls and notes without risk assessments...\n");

  // Get all completed Gong calls
  const allCompletedCalls = await prisma.gongCall.findMany({
    where: {
      parsingStatus: "completed",
      transcriptText: { not: null },
    },
    select: {
      id: true,
      title: true,
      parsedAt: true,
      riskAssessment: true,
      transcriptText: true,
      opportunityId: true,
      meetingDate: true,
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
      transcriptText: { not: null },
    },
    select: {
      id: true,
      title: true,
      parsedAt: true,
      riskAssessment: true,
      transcriptText: true,
      opportunityId: true,
      meetingDate: true,
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
      // Run risk analysis directly
      console.log(`   ⏳ Analyzing risk...`);
      const result = await analyzeCallRisk(call.transcriptText!);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Risk analysis failed");
      }

      // Save to database
      await prisma.gongCall.update({
        where: { id: call.id },
        data: {
          riskAssessment: JSON.parse(JSON.stringify(result.data)),
        },
      });

      // Update opportunity history
      await appendRiskToOpportunityHistory({
        opportunityId: call.opportunityId,
        gongCallId: call.id,
        meetingDate: call.meetingDate,
        riskAssessment: result.data,
      });

      console.log(`   ✅ Risk analysis completed: ${result.data.riskLevel.toUpperCase()}`);
      console.log(`   ✅ Risk history updated for opportunity`);

      // Add delay to avoid rate limiting (Gemini API)
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
      // Run risk analysis directly
      console.log(`   ⏳ Analyzing risk...`);
      const result = await analyzeCallRisk(note.transcriptText!);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Risk analysis failed");
      }

      // Save to database
      await prisma.granolaNote.update({
        where: { id: note.id },
        data: {
          riskAssessment: JSON.parse(JSON.stringify(result.data)),
        },
      });

      // Update opportunity history
      await appendRiskToGranolaHistory({
        opportunityId: note.opportunityId,
        granolaId: note.id,
        meetingDate: note.meetingDate,
        riskAssessment: result.data,
      });

      console.log(`   ✅ Risk analysis completed: ${result.data.riskLevel.toUpperCase()}`);
      console.log(`   ✅ Risk history updated for opportunity`);

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Backfill complete!");
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
