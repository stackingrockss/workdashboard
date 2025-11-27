/**
 * Seeds Verifiable company content for a specific organization.
 *
 * Usage:
 *   npx tsx scripts/seed-verifiable-content.ts --org=<organizationId>
 *   npx tsx scripts/seed-verifiable-content.ts --org=<organizationId> --dry-run
 *   npx tsx scripts/seed-verifiable-content.ts --org=<organizationId> --user=<userId>
 *
 * Options:
 *   --org      Organization ID (required)
 *   --user     User ID for createdById (defaults to first admin in org)
 *   --dry-run  Preview what would be created without making changes
 */

import { PrismaClient } from "@prisma/client";
import { VERIFIABLE_CONTENT } from "../src/lib/data/verifiable-content";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const orgId = args.find((a) => a.startsWith("--org="))?.split("=")[1];
  const userId = args.find((a) => a.startsWith("--user="))?.split("=")[1];
  const isDryRun = args.includes("--dry-run");

  if (!orgId) {
    console.error("Error: --org=<organizationId> is required");
    console.error(
      "\nUsage: npx tsx scripts/seed-verifiable-content.ts --org=<organizationId> [--dry-run] [--user=<userId>]"
    );
    process.exit(1);
  }

  // Verify organization exists
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    console.error(`Error: Organization ${orgId} not found`);
    process.exit(1);
  }

  // Get user for createdById (use provided or find first admin)
  let createdById = userId;
  if (!createdById) {
    const adminUser = await prisma.user.findFirst({
      where: { organizationId: orgId, role: "ADMIN" },
    });
    if (!adminUser) {
      console.error(
        "Error: No admin user found in organization. Provide --user=<userId>"
      );
      process.exit(1);
    }
    createdById = adminUser.id;
  } else {
    // Verify the provided user exists and belongs to the org
    const user = await prisma.user.findFirst({
      where: { id: createdById, organizationId: orgId },
    });
    if (!user) {
      console.error(
        `Error: User ${createdById} not found or not in organization ${orgId}`
      );
      process.exit(1);
    }
  }

  console.log(`\n🚀 Seeding Verifiable content for: ${org.name} (${orgId})`);
  console.log(`   Created by user ID: ${createdById}`);
  if (isDryRun) console.log("   ⚠️  DRY RUN - No changes will be made\n");
  else console.log("");

  let created = 0;
  let skipped = 0;

  for (const item of VERIFIABLE_CONTENT) {
    // Check if URL already exists (idempotency)
    const existing = await prisma.content.findUnique({
      where: { organizationId_url: { organizationId: orgId, url: item.url } },
    });

    if (existing) {
      console.log(`  [SKIP] "${item.title}"`);
      skipped++;
      continue;
    }

    if (!isDryRun) {
      await prisma.content.create({
        data: {
          title: item.title,
          url: item.url,
          description: item.description,
          contentType: item.contentType,
          organizationId: orgId,
          createdById,
        },
      });
    }
    console.log(`  [CREATE] "${item.title}"`);
    created++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ${isDryRun ? "Would create" : "Created"}: ${created}`);
  console.log(`   Skipped (already exists): ${skipped}`);
  console.log(`   Total items in data file: ${VERIFIABLE_CONTENT.length}`);

  if (!isDryRun && created > 0) {
    console.log(`\n✅ Successfully seeded ${created} content items!`);
  } else if (isDryRun && created > 0) {
    console.log(`\n💡 Run without --dry-run to create ${created} content items.`);
  } else if (created === 0) {
    console.log(`\n✅ All content items already exist. Nothing to do.`);
  }
}

main()
  .catch((e) => {
    console.error("\n❌ Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
