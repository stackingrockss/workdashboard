/**
 * Migration Script: CompanySettings → Organization.fiscalYearStartMonth
 *
 * This script migrates user-level fiscal year settings from the deprecated
 * CompanySettings table to the Organization table.
 *
 * Strategy:
 * 1. Find all CompanySettings records
 * 2. For each record, find the user's organization
 * 3. Update the organization's fiscalYearStartMonth
 * 4. Delete the CompanySettings record after successful migration
 *
 * Run with: npx tsx scripts/migrate-company-settings.ts
 */

import { prisma } from '../src/lib/db';
import { getQuarterFromDate } from '../src/lib/utils/quarter';

async function migrateCompanySettings() {
  console.log('🚀 Starting CompanySettings migration...\n');

  try {
    // Get all CompanySettings records
    const companySettings = await prisma.companySettings.findMany({
      include: {
        user: {
          include: {
            organization: true,
          },
        },
      },
    });

    console.log(`Found ${companySettings.length} CompanySettings records to migrate\n`);

    if (companySettings.length === 0) {
      console.log('✅ No CompanySettings to migrate. Migration complete!');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const settings of companySettings) {
      const { user, fiscalYearStartMonth } = settings;

      if (!user.organization) {
        console.warn(
          `⚠️  User ${user.email} (${user.id}) has no organization. Skipping...`
        );
        skippedCount++;
        continue;
      }

      const orgId = user.organization.id;
      const orgName = user.organization.name;

      try {
        console.log(
          `📝 Migrating settings for user ${user.email} → Org: ${orgName} (${orgId})`
        );
        console.log(`   Current org fiscal year start: ${user.organization.fiscalYearStartMonth}`);
        console.log(`   New fiscal year start month: ${fiscalYearStartMonth}`);

        // Only update if different
        if (user.organization.fiscalYearStartMonth !== fiscalYearStartMonth) {
          // Update organization's fiscal year start month
          await prisma.organization.update({
            where: { id: orgId },
            data: { fiscalYearStartMonth },
          });

          console.log(`   ✅ Updated organization fiscal year start month`);

          // Recalculate quarters for all opportunities in this organization
          const opportunities = await prisma.opportunity.findMany({
            where: {
              ownerId: user.id,
              closeDate: { not: null },
            },
          });

          if (opportunities.length > 0) {
            console.log(`   📊 Recalculating quarters for ${opportunities.length} opportunities...`);

            for (const opp of opportunities) {
              if (opp.closeDate) {
                const newQuarter = getQuarterFromDate(opp.closeDate, fiscalYearStartMonth);
                await prisma.opportunity.update({
                  where: { id: opp.id },
                  data: { quarter: newQuarter },
                });
              }
            }

            console.log(`   ✅ Updated quarters for ${opportunities.length} opportunities`);
          }
        } else {
          console.log(`   ⏭️  Fiscal year already matches. No update needed.`);
        }

        // Delete the CompanySettings record
        await prisma.companySettings.delete({
          where: { id: settings.id },
        });

        console.log(`   🗑️  Deleted CompanySettings record\n`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating settings for user ${user.email}:`, error);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (no organization): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60) + '\n');

    if (errorCount === 0 && skippedCount === 0) {
      console.log('🎉 Migration completed successfully! All CompanySettings have been migrated.');
    } else if (errorCount > 0) {
      console.warn('⚠️  Migration completed with errors. Please review the error messages above.');
    } else {
      console.log('✅ Migration completed. Some records were skipped (see warnings above).');
    }
  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateCompanySettings()
  .then(() => {
    console.log('\n✅ Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
