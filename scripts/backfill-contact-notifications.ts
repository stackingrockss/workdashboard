/**
 * Backfill script: Create ContactsReadyNotification records for already-parsed calls
 *
 * This script finds all GongCall and GranolaNote records that:
 * 1. Have parsedPeople with at least one person
 * 2. Don't already have a ContactsReadyNotification
 *
 * Run with: npx tsx scripts/backfill-contact-notifications.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ParsedPerson {
  name: string;
  title?: string;
  company?: string;
  email?: string;
}

async function backfillContactNotifications() {
  console.log("🔍 Starting backfill of contact notifications...\n");

  // Track stats
  let gongCreated = 0;
  let gongSkipped = 0;
  let granolaCreated = 0;
  let granolaSkipped = 0;

  // ========================================
  // Process Gong Calls
  // ========================================
  console.log("📞 Processing Gong calls...");

  const gongCalls = await prisma.gongCall.findMany({
    where: {
      parsingStatus: "completed",
      NOT: { opportunityId: null },
    },
    include: {
      opportunity: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          organizationId: true,
        },
      },
    },
  });

  console.log(`   Found ${gongCalls.length} parsed Gong calls`);

  for (const call of gongCalls) {
    if (!call.opportunity) continue;

    // Check if parsedPeople has data
    const parsedPeople = call.parsedPeople as ParsedPerson[] | null;
    if (!parsedPeople || !Array.isArray(parsedPeople) || parsedPeople.length === 0) {
      gongSkipped++;
      continue;
    }

    // Check if notification already exists
    const existing = await prisma.contactsReadyNotification.findUnique({
      where: {
        userId_gongCallId: {
          userId: call.opportunity.ownerId,
          gongCallId: call.id,
        },
      },
    });

    if (existing) {
      gongSkipped++;
      continue;
    }

    // Create notification
    try {
      await prisma.contactsReadyNotification.create({
        data: {
          userId: call.opportunity.ownerId,
          organizationId: call.opportunity.organizationId,
          gongCallId: call.id,
          contactCount: parsedPeople.length,
          opportunityId: call.opportunity.id,
          opportunityName: call.opportunity.name,
          callTitle: call.title || "Gong Recording",
        },
      });
      gongCreated++;
      console.log(`   ✅ Created notification for "${call.title}" (${parsedPeople.length} contacts)`);
    } catch (error) {
      console.error(`   ❌ Failed to create notification for ${call.id}:`, error);
    }
  }

  // ========================================
  // Process Granola Notes
  // ========================================
  console.log("\n📝 Processing Granola notes...");

  const allGranolaNotes = await prisma.granolaNote.findMany({
    where: {
      parsingStatus: "completed",
    },
    include: {
      opportunity: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          organizationId: true,
        },
      },
    },
  });

  // Filter to only those with opportunities
  const granolaNotes = allGranolaNotes.filter(n => n.opportunityId && n.opportunity);

  console.log(`   Found ${granolaNotes.length} parsed Granola notes`);

  for (const note of granolaNotes) {
    if (!note.opportunity) continue;

    // Check if parsedPeople has data
    const parsedPeople = note.parsedPeople as ParsedPerson[] | null;
    if (!parsedPeople || !Array.isArray(parsedPeople) || parsedPeople.length === 0) {
      granolaSkipped++;
      continue;
    }

    // Check if notification already exists
    const existing = await prisma.contactsReadyNotification.findUnique({
      where: {
        userId_granolaNoteId: {
          userId: note.opportunity.ownerId,
          granolaNoteId: note.id,
        },
      },
    });

    if (existing) {
      granolaSkipped++;
      continue;
    }

    // Create notification
    try {
      await prisma.contactsReadyNotification.create({
        data: {
          userId: note.opportunity.ownerId,
          organizationId: note.opportunity.organizationId,
          granolaNoteId: note.id,
          contactCount: parsedPeople.length,
          opportunityId: note.opportunity.id,
          opportunityName: note.opportunity.name,
          callTitle: note.title || "Granola Note",
        },
      });
      granolaCreated++;
      console.log(`   ✅ Created notification for "${note.title}" (${parsedPeople.length} contacts)`);
    } catch (error) {
      console.error(`   ❌ Failed to create notification for ${note.id}:`, error);
    }
  }

  // ========================================
  // Summary
  // ========================================
  console.log("\n" + "=".repeat(50));
  console.log("📊 BACKFILL COMPLETE");
  console.log("=".repeat(50));
  console.log(`\nGong Calls:`);
  console.log(`   ✅ Created: ${gongCreated}`);
  console.log(`   ⏭️  Skipped: ${gongSkipped} (no contacts or already has notification)`);
  console.log(`\nGranola Notes:`);
  console.log(`   ✅ Created: ${granolaCreated}`);
  console.log(`   ⏭️  Skipped: ${granolaSkipped} (no contacts or already has notification)`);
  console.log(`\n🎉 Total notifications created: ${gongCreated + granolaCreated}`);
}

backfillContactNotifications()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
