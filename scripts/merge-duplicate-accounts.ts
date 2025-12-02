/**
 * Script to find and merge duplicate accounts (case-insensitive)
 *
 * Usage:
 *   npx ts-node scripts/merge-duplicate-accounts.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be merged without making changes
 *
 * This script:
 * 1. Finds accounts with similar names (case-insensitive) within each organization
 * 2. For each duplicate group, keeps the first account (by createdAt) as primary
 * 3. Moves all related records (opportunities, contacts, etc.) to the primary account
 * 4. Deletes the duplicate accounts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface DuplicateGroup {
  normalizedName: string;
  organizationId: string;
  accounts: {
    id: string;
    name: string;
    createdAt: Date;
  }[];
}

async function findDuplicateAccounts(): Promise<DuplicateGroup[]> {
  // Get all accounts grouped by organization
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      name: true,
      organizationId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by normalized name (lowercase, trimmed) within each organization
  const groupMap = new Map<string, DuplicateGroup>();

  for (const account of accounts) {
    const normalizedName = account.name.toLowerCase().trim();
    const key = `${account.organizationId}:${normalizedName}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        normalizedName,
        organizationId: account.organizationId,
        accounts: [],
      });
    }

    groupMap.get(key)!.accounts.push({
      id: account.id,
      name: account.name,
      createdAt: account.createdAt,
    });
  }

  // Filter to only groups with duplicates (more than 1 account)
  return Array.from(groupMap.values()).filter(
    (group) => group.accounts.length > 1
  );
}

async function mergeAccounts(
  primaryAccountId: string,
  duplicateAccountIds: string[],
  dryRun: boolean
): Promise<void> {
  for (const duplicateId of duplicateAccountIds) {
    console.log(`  Moving records from ${duplicateId} to ${primaryAccountId}`);

    if (dryRun) {
      // Count what would be moved
      const [opportunities, contacts, calendarEvents, tasks, secFilings, earningsTranscripts, chatMessages] =
        await Promise.all([
          prisma.opportunity.count({ where: { accountId: duplicateId } }),
          prisma.contact.count({ where: { accountId: duplicateId } }),
          prisma.calendarEvent.count({ where: { accountId: duplicateId } }),
          prisma.task.count({ where: { accountId: duplicateId } }),
          prisma.secFiling.count({ where: { accountId: duplicateId } }),
          prisma.earningsCallTranscript.count({ where: { accountId: duplicateId } }),
          prisma.chatMessage.count({ where: { accountId: duplicateId } }),
        ]);

      console.log(`    Would move: ${opportunities} opportunities, ${contacts} contacts, ${calendarEvents} calendar events, ${tasks} tasks, ${secFilings} SEC filings, ${earningsTranscripts} earnings transcripts, ${chatMessages} chat messages`);
    } else {
      // Move all related records to primary account
      await Promise.all([
        prisma.opportunity.updateMany({
          where: { accountId: duplicateId },
          data: { accountId: primaryAccountId },
        }),
        prisma.contact.updateMany({
          where: { accountId: duplicateId },
          data: { accountId: primaryAccountId },
        }),
        prisma.calendarEvent.updateMany({
          where: { accountId: duplicateId },
          data: { accountId: primaryAccountId },
        }),
        prisma.task.updateMany({
          where: { accountId: duplicateId },
          data: { accountId: primaryAccountId },
        }),
        prisma.secFiling.updateMany({
          where: { accountId: duplicateId },
          data: { accountId: primaryAccountId },
        }),
        prisma.earningsCallTranscript.updateMany({
          where: { accountId: duplicateId },
          data: { accountId: primaryAccountId },
        }),
        prisma.chatMessage.updateMany({
          where: { accountId: duplicateId },
          data: { accountId: primaryAccountId },
        }),
      ]);

      // Delete the duplicate account
      await prisma.account.delete({
        where: { id: duplicateId },
      });
      console.log(`    Deleted duplicate account ${duplicateId}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    console.log("=== DRY RUN MODE - No changes will be made ===\n");
  }

  console.log("Finding duplicate accounts...\n");
  const duplicates = await findDuplicateAccounts();

  if (duplicates.length === 0) {
    console.log("No duplicate accounts found!");
    return;
  }

  console.log(`Found ${duplicates.length} duplicate groups:\n`);

  for (const group of duplicates) {
    console.log(`\n"${group.normalizedName}" (Organization: ${group.organizationId})`);
    console.log("  Accounts:");

    // Sort by createdAt to determine primary (oldest first)
    group.accounts.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const [primary, ...duplicateAccounts] = group.accounts;

    console.log(`    PRIMARY: "${primary.name}" (${primary.id}) - created ${primary.createdAt.toISOString()}`);

    for (const dup of duplicateAccounts) {
      console.log(`    DUPLICATE: "${dup.name}" (${dup.id}) - created ${dup.createdAt.toISOString()}`);
    }

    // Merge duplicates into primary
    await mergeAccounts(
      primary.id,
      duplicateAccounts.map((d) => d.id),
      dryRun
    );
  }

  console.log("\n" + (dryRun ? "Dry run complete." : "Merge complete!"));
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
