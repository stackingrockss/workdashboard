/**
 * Consolidate all data to Verifiable organization
 *
 * This script:
 * 1. Moves accounts from Matt Seelig's org to Verifiable (they're already linked to Verifiable opportunities)
 * 2. Deletes the orphan "Loyal Source" account in Matt's org
 * 3. Deletes empty test organizations (Priya, Matt's snoboardfrk, Marco)
 * 4. Deletes Matt Seelig's Organization after migration
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VERIFIABLE_ORG_ID = "org-cmgoglx2j0000l4040kcwwy3j";
const MATT_SEELIG_ORG_ID = "org-u1";

// Organizations to delete (empty ones)
const ORGS_TO_DELETE = [
  "org-u2",  // Priya Singh's Organization
  "org-u3",  // Marco Ruiz's Organization
  "org-cmhmmu5ix0000ic04v7pgmljp",  // Matt's Organization (snoboardfrk)
];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    console.log("=== DRY RUN MODE - No changes will be made ===\n");
  }

  // Step 1: Find accounts in Matt's org that are linked to Verifiable opportunities
  console.log("Step 1: Finding accounts to migrate...\n");

  const accountsInMattOrg = await prisma.account.findMany({
    where: { organizationId: MATT_SEELIG_ORG_ID },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          opportunities: true,
          contacts: true,
          calendarEvents: true,
          tasks: true,
          secFilings: true,
          earningsTranscripts: true,
        },
      },
    },
  });

  // Check which accounts are referenced by Verifiable opportunities
  const verifiableOpps = await prisma.opportunity.findMany({
    where: { organizationId: VERIFIABLE_ORG_ID },
    select: { accountId: true },
  });
  const verifiableAccountIds = new Set(verifiableOpps.map((o) => o.accountId).filter(Boolean));

  const accountsToMigrate = accountsInMattOrg.filter((a) => verifiableAccountIds.has(a.id));
  const accountsToDelete = accountsInMattOrg.filter((a) => !verifiableAccountIds.has(a.id));

  console.log("Accounts to MIGRATE to Verifiable:");
  for (const account of accountsToMigrate) {
    console.log(`  - ${account.name} (${account.id})`);
  }

  console.log("\nAccounts to DELETE (orphans not linked to any Verifiable opportunity):");
  for (const account of accountsToDelete) {
    console.log(`  - ${account.name} (${account.id})`);
  }

  // Step 2: Migrate accounts
  console.log("\nStep 2: Migrating accounts to Verifiable...\n");

  if (!dryRun) {
    for (const account of accountsToMigrate) {
      await prisma.account.update({
        where: { id: account.id },
        data: { organizationId: VERIFIABLE_ORG_ID },
      });
      console.log(`  Migrated: ${account.name}`);
    }
  } else {
    console.log(`  Would migrate ${accountsToMigrate.length} accounts`);
  }

  // Step 3: Delete orphan accounts
  console.log("\nStep 3: Deleting orphan accounts...\n");

  if (!dryRun) {
    for (const account of accountsToDelete) {
      await prisma.account.delete({
        where: { id: account.id },
      });
      console.log(`  Deleted: ${account.name}`);
    }
  } else {
    console.log(`  Would delete ${accountsToDelete.length} orphan accounts`);
  }

  // Step 4: Delete empty test organizations
  console.log("\nStep 4: Deleting empty test organizations...\n");

  for (const orgId of ORGS_TO_DELETE) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    if (org) {
      if (!dryRun) {
        // Delete the user first (cascade will handle most things)
        await prisma.user.deleteMany({
          where: { organizationId: orgId },
        });
        await prisma.organization.delete({
          where: { id: orgId },
        });
        console.log(`  Deleted org: ${org.name} (${orgId})`);
      } else {
        console.log(`  Would delete org: ${org.name} (${orgId})`);
      }
    }
  }

  // Step 5: Delete Matt Seelig's Organization
  console.log("\nStep 5: Deleting Matt Seelig's Organization...\n");

  // Re-check after migrations/deletions
  const mattOrgCheck = await prisma.organization.findUnique({
    where: { id: MATT_SEELIG_ORG_ID },
    select: {
      name: true,
      _count: {
        select: {
          accounts: true,
          opportunities: true,
          users: true,
        },
      },
    },
  });

  if (mattOrgCheck) {
    // In dry-run, calculate what WOULD remain after migrations
    const remainingAccountsAfterMigration = dryRun
      ? mattOrgCheck._count.accounts - accountsToMigrate.length - accountsToDelete.length
      : mattOrgCheck._count.accounts;

    console.log(`  Org: ${mattOrgCheck.name}`);
    console.log(`  Accounts after migration: ${remainingAccountsAfterMigration}`);
    console.log(`  Opportunities: ${mattOrgCheck._count.opportunities}`);
    console.log(`  Users: ${mattOrgCheck._count.users}`);

    if (remainingAccountsAfterMigration > 0 || mattOrgCheck._count.opportunities > 0) {
      console.log("\n  WARNING: Organization would still have data! Skipping deletion.");
    } else {
      if (!dryRun) {
        await prisma.user.deleteMany({
          where: { organizationId: MATT_SEELIG_ORG_ID },
        });
        await prisma.organization.delete({
          where: { id: MATT_SEELIG_ORG_ID },
        });
        console.log(`  Deleted org: ${mattOrgCheck.name}`);
      } else {
        console.log(`  Would delete org: ${mattOrgCheck.name}`);
      }
    }
  }

  // Final summary
  console.log("\n=== FINAL SUMMARY ===\n");

  const finalVerifiable = await prisma.organization.findUnique({
    where: { id: VERIFIABLE_ORG_ID },
    select: {
      name: true,
      _count: {
        select: {
          accounts: true,
          opportunities: true,
          users: true,
        },
      },
    },
  });

  const remainingOrgs = await prisma.organization.count();

  // Calculate projected counts for dry run
  const projectedAccounts = dryRun
    ? (finalVerifiable?._count.accounts || 0) + accountsToMigrate.length
    : finalVerifiable?._count.accounts;

  console.log(`Verifiable org ${dryRun ? "will have" : "now has"}:`);
  console.log(`  - ${projectedAccounts} accounts`);
  console.log(`  - ${finalVerifiable?._count.opportunities} opportunities`);
  console.log(`  - ${finalVerifiable?._count.users} users`);

  const projectedOrgCount = dryRun ? remainingOrgs - ORGS_TO_DELETE.length - 1 : remainingOrgs;
  console.log(`\nTotal organizations ${dryRun ? "will be" : "remaining"}: ${projectedOrgCount}`);

  if (dryRun) {
    console.log("\n[DRY RUN] No changes were made. Run without --dry-run to apply changes.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
