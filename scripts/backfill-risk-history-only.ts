// scripts/backfill-risk-history-only.ts
// Backfill risk assessment HISTORY for calls that already have risk assessments
// but are missing the history entry on the opportunity

import { PrismaClient } from "@prisma/client";
import { appendRiskToOpportunityHistory, appendRiskToGranolaHistory } from "../src/lib/utils/risk-assessment-history";
import type { RiskAssessment } from "../src/lib/validations/gong-call";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Finding calls with risk assessments that need history backfill...\n");

  // Get all Gong calls with risk assessments
  const callsWithRisk = await prisma.gongCall.findMany({
    where: {
      parsingStatus: "completed",
      riskAssessment: { not: null },
    },
    select: {
      id: true,
      title: true,
      riskAssessment: true,
      opportunityId: true,
      meetingDate: true,
      opportunity: {
        select: {
          id: true,
          name: true,
          riskAssessmentHistory: true,
          parsedGongCallIds: true,
        },
      },
    },
    orderBy: {
      meetingDate: "desc",
    },
  });

  // Get all Granola notes with risk assessments
  const notesWithRisk = await prisma.granolaNote.findMany({
    where: {
      parsingStatus: "completed",
      riskAssessment: { not: null },
    },
    select: {
      id: true,
      title: true,
      riskAssessment: true,
      opportunityId: true,
      meetingDate: true,
      opportunity: {
        select: {
          id: true,
          name: true,
          riskAssessmentHistory: true,
          parsedGranolaIds: true,
        },
      },
    },
    orderBy: {
      meetingDate: "desc",
    },
  });

  // Filter for calls where history is empty or doesn't exist
  const callsNeedingHistory = callsWithRisk.filter((call) => {
    const history = call.opportunity.riskAssessmentHistory;
    return !history || history.trim() === "";
  });

  const notesNeedingHistory = notesWithRisk.filter((note) => {
    const history = note.opportunity.riskAssessmentHistory;
    return !history || history.trim() === "";
  });

  // Deduplicate by opportunity (we only need to process once per opportunity)
  const opportunitiesProcessed = new Set<string>();

  console.log(`Found ${callsWithRisk.length} Gong calls with risk assessments`);
  console.log(`Found ${notesWithRisk.length} Granola notes with risk assessments`);
  console.log(`Found ${callsNeedingHistory.length} calls where opportunity needs history backfill`);
  console.log(`Found ${notesNeedingHistory.length} notes where opportunity needs history backfill`);
  console.log("=".repeat(80));

  if (callsNeedingHistory.length === 0 && notesNeedingHistory.length === 0) {
    console.log("\n✅ All opportunities already have risk assessment history!");
    return;
  }

  // Process Gong calls
  for (let i = 0; i < callsNeedingHistory.length; i++) {
    const call = callsNeedingHistory[i];

    // Skip if we've already processed this opportunity
    if (opportunitiesProcessed.has(call.opportunityId)) {
      continue;
    }

    const progress = `[${i + 1}/${callsNeedingHistory.length}]`;

    console.log(`\n📞 ${progress} ${call.title}`);
    console.log(`   Opportunity: ${call.opportunity.name}`);
    console.log(`   Call ID: ${call.id}`);

    try {
      // First, we need to temporarily remove this call from parsedGongCallIds
      // so the history function will process it
      const originalIds = call.opportunity.parsedGongCallIds;

      if (originalIds.includes(call.id)) {
        await prisma.opportunity.update({
          where: { id: call.opportunityId },
          data: {
            parsedGongCallIds: originalIds.filter(id => id !== call.id),
          },
        });
      }

      // Update opportunity history
      await appendRiskToOpportunityHistory({
        opportunityId: call.opportunityId,
        gongCallId: call.id,
        meetingDate: call.meetingDate,
        riskAssessment: call.riskAssessment as RiskAssessment,
      });

      // Restore the parsedGongCallIds (it gets added back by the function)

      const riskLevel = (call.riskAssessment as RiskAssessment).riskLevel;
      console.log(`   ✅ Risk history added: ${riskLevel.toUpperCase()}`);

      opportunitiesProcessed.add(call.opportunityId);
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Process Granola notes
  for (let i = 0; i < notesNeedingHistory.length; i++) {
    const note = notesNeedingHistory[i];

    // Skip if we've already processed this opportunity
    if (opportunitiesProcessed.has(note.opportunityId)) {
      continue;
    }

    const progress = `[${i + 1}/${notesNeedingHistory.length}]`;

    console.log(`\n📝 ${progress} ${note.title}`);
    console.log(`   Opportunity: ${note.opportunity.name}`);
    console.log(`   Note ID: ${note.id}`);

    try {
      // First, we need to temporarily remove this note from parsedGranolaIds
      const originalIds = note.opportunity.parsedGranolaIds;

      if (originalIds.includes(note.id)) {
        await prisma.opportunity.update({
          where: { id: note.opportunityId },
          data: {
            parsedGranolaIds: originalIds.filter(id => id !== note.id),
          },
        });
      }

      // Update opportunity history
      await appendRiskToGranolaHistory({
        opportunityId: note.opportunityId,
        granolaId: note.id,
        meetingDate: note.meetingDate,
        riskAssessment: note.riskAssessment as RiskAssessment,
      });

      const riskLevel = (note.riskAssessment as RiskAssessment).riskLevel;
      console.log(`   ✅ Risk history added: ${riskLevel.toUpperCase()}`);

      opportunitiesProcessed.add(note.opportunityId);
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n✅ Backfill complete! Processed ${opportunitiesProcessed.size} opportunities.`);
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
