// scripts/reparse-all-transcripts.ts
// Re-parse all existing Gong calls and Granola notes to extract enhanced insights:
// - keyQuotes, objections, competitionMentions, decisionProcess, callSentiment
//
// This script triggers Inngest background jobs for each transcript, which will:
// 1. Re-parse the transcript with the updated AI prompt
// 2. Save the new fields to the database
// 3. Update history tracking
// 4. Trigger consolidation for the opportunity
//
// Usage: npx tsx scripts/reparse-all-transcripts.ts [--dry-run] [--gong-only] [--granola-only]

import { PrismaClient, ParsingStatus } from "@prisma/client";
import { Inngest } from "inngest";

const prisma = new PrismaClient();

// Create Inngest client for sending events
const inngest = new Inngest({
  id: "reparse-script",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const gongOnly = args.includes("--gong-only");
const granolaOnly = args.includes("--granola-only");

async function main() {
  console.log("=".repeat(80));
  console.log("🔄 Re-parse All Transcripts for Enhanced Insights");
  console.log("=".repeat(80));
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  if (gongOnly) console.log("Filter: Gong calls only");
  if (granolaOnly) console.log("Filter: Granola notes only");
  console.log("");

  // Count and fetch all completed transcripts
  const gongCalls = granolaOnly
    ? []
    : await prisma.gongCall.findMany({
        where: {
          parsingStatus: ParsingStatus.completed,
          transcriptText: { not: null },
        },
        select: {
          id: true,
          title: true,
          transcriptText: true,
          opportunity: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { meetingDate: "desc" },
      });

  const granolaNotes = gongOnly
    ? []
    : await prisma.granolaNote.findMany({
        where: {
          parsingStatus: ParsingStatus.completed,
          transcriptText: { not: null },
        },
        select: {
          id: true,
          title: true,
          transcriptText: true,
          opportunity: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { meetingDate: "desc" },
      });

  const totalCount = gongCalls.length + granolaNotes.length;

  console.log(`Found ${gongCalls.length} Gong calls to re-parse`);
  console.log(`Found ${granolaNotes.length} Granola notes to re-parse`);
  console.log(`Total: ${totalCount} transcripts`);
  console.log("");

  if (totalCount === 0) {
    console.log("✅ No transcripts need re-parsing!");
    return;
  }

  if (isDryRun) {
    console.log("📋 DRY RUN - Would re-parse the following:");
    console.log("");

    if (gongCalls.length > 0) {
      console.log("GONG CALLS:");
      for (const call of gongCalls) {
        const charCount = call.transcriptText?.length || 0;
        console.log(`  📞 ${call.title} (${charCount.toLocaleString()} chars)`);
        console.log(`     Opportunity: ${call.opportunity.name}`);
      }
    }

    if (granolaNotes.length > 0) {
      console.log("\nGRANOLA NOTES:");
      for (const note of granolaNotes) {
        const charCount = note.transcriptText?.length || 0;
        console.log(`  📝 ${note.title} (${charCount.toLocaleString()} chars)`);
        console.log(`     Opportunity: ${note.opportunity.name}`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("💡 Run without --dry-run to execute re-parsing");
    return;
  }

  // Track affected opportunities for consolidation
  const affectedOpportunityIds = new Set<string>();

  // Process Gong calls
  if (gongCalls.length > 0) {
    console.log("📞 Processing Gong calls...\n");

    for (let i = 0; i < gongCalls.length; i++) {
      const call = gongCalls[i];
      const progress = `[${i + 1}/${gongCalls.length}]`;

      console.log(`${progress} ${call.title}`);
      console.log(`   Opportunity: ${call.opportunity.name}`);

      try {
        // Reset parsing status
        await prisma.gongCall.update({
          where: { id: call.id },
          data: {
            parsingStatus: ParsingStatus.pending,
            parsingError: null,
            // Clear old enhanced fields to ensure fresh extraction
            keyQuotes: null,
            objections: null,
            competitionMentions: null,
            decisionProcess: null,
            callSentiment: null,
          },
        });

        // Trigger parsing via Inngest
        await inngest.send({
          name: "gong/transcript.parse",
          data: {
            gongCallId: call.id,
            transcriptText: call.transcriptText,
          },
        });

        affectedOpportunityIds.add(call.opportunity.id);
        console.log(`   ✅ Parsing triggered`);

        // Small delay to avoid overwhelming Inngest
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Process Granola notes
  if (granolaNotes.length > 0) {
    console.log("\n📝 Processing Granola notes...\n");

    for (let i = 0; i < granolaNotes.length; i++) {
      const note = granolaNotes[i];
      const progress = `[${i + 1}/${granolaNotes.length}]`;

      console.log(`${progress} ${note.title}`);
      console.log(`   Opportunity: ${note.opportunity.name}`);

      try {
        // Reset parsing status
        await prisma.granolaNote.update({
          where: { id: note.id },
          data: {
            parsingStatus: ParsingStatus.pending,
            parsingError: null,
            // Clear old enhanced fields to ensure fresh extraction
            keyQuotes: null,
            objections: null,
            competitionMentions: null,
            decisionProcess: null,
            callSentiment: null,
          },
        });

        // Trigger parsing via Inngest
        await inngest.send({
          name: "granola/transcript.parse",
          data: { granolaId: note.id },
        });

        affectedOpportunityIds.add(note.opportunity.id);
        console.log(`   ✅ Parsing triggered`);

        // Small delay to avoid overwhelming Inngest
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Re-parsing triggered for all transcripts!");
  console.log(`\n📊 Summary:`);
  console.log(`   - Gong calls: ${gongCalls.length}`);
  console.log(`   - Granola notes: ${granolaNotes.length}`);
  console.log(`   - Affected opportunities: ${affectedOpportunityIds.size}`);
  console.log(`\n💡 Monitor progress in Inngest dashboard: https://app.inngest.com`);
  console.log(`💡 Jobs run async - parsing and consolidation will complete in background`);
  console.log(`\n📋 After completion, each opportunity's consolidated insights will be updated`);
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
