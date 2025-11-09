/**
 * Migration Script: Fix Opportunity Organization IDs
 *
 * This script fixes opportunities that have missing or incorrect organizationId values
 * by setting them to match their owner's organizationId.
 *
 * Usage:
 *   npx tsx scripts/fix-opportunity-organizations.ts [--dry-run]
 *
 * Options:
 *   --dry-run: Preview changes without applying them
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  fixed: number;
  skipped: number;
  errors: string[];
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('🔍 Scanning opportunities for organization issues...\n');
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  const stats: MigrationStats = {
    total: 0,
    fixed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get all opportunities with their owners
    const opportunities = await prisma.opportunity.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            organizationId: true,
          },
        },
      },
    });

    stats.total = opportunities.length;
    console.log(`📊 Found ${stats.total} opportunities\n`);

    // Process each opportunity
    for (const opp of opportunities) {
      const { id, name, organizationId, owner } = opp;

      // Check if owner exists
      if (!owner) {
        console.log(`❌ [${id}] "${name}" - Owner not found, skipping`);
        stats.errors.push(`${id}: Owner not found`);
        stats.skipped++;
        continue;
      }

      // Check if owner has an organization
      if (!owner.organizationId) {
        console.log(`❌ [${id}] "${name}" - Owner (${owner.email}) has no organization, skipping`);
        stats.errors.push(`${id}: Owner has no organization`);
        stats.skipped++;
        continue;
      }

      // Check if organizationId needs to be updated
      if (organizationId === owner.organizationId) {
        // Already correct
        stats.skipped++;
        continue;
      }

      // Fix the organizationId
      console.log(
        `🔧 [${id}] "${name}" - Updating organizationId from ${organizationId || 'null'} to ${owner.organizationId} (owner: ${owner.email})`
      );

      if (!isDryRun) {
        try {
          await prisma.opportunity.update({
            where: { id },
            data: {
              organizationId: owner.organizationId,
            },
          });
          stats.fixed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.log(`❌ [${id}] Failed to update: ${errorMsg}`);
          stats.errors.push(`${id}: ${errorMsg}`);
        }
      } else {
        stats.fixed++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Total opportunities:     ${stats.total}`);
    console.log(`Fixed:                   ${stats.fixed}`);
    console.log(`Skipped (already OK):    ${stats.skipped - stats.errors.length}`);
    console.log(`Errors:                  ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.forEach(err => console.log(`   - ${err}`));
    }

    if (isDryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes were applied');
      console.log('Run without --dry-run to apply these changes');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
