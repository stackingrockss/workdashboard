/**
 * Move Opportunities to Different Organization
 *
 * This script moves all opportunities from one organization to another,
 * and updates the owner to a user in the target organization.
 *
 * Usage:
 *   npx tsx scripts/move-opportunities-to-org.ts <target-org-id> <new-owner-id> [--dry-run]
 *
 * Example:
 *   npx tsx scripts/move-opportunities-to-org.ts org-cmgoglx2j0000l4040kcwwy3j cmgoglx2j0000l4040kcwwy3j --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const targetOrgId = args[0];
  const newOwnerId = args[1];

  if (!targetOrgId || !newOwnerId) {
    console.error('❌ Usage: npx tsx scripts/move-opportunities-to-org.ts <target-org-id> <new-owner-id> [--dry-run]');
    console.error('\nExample: npx tsx scripts/move-opportunities-to-org.ts org-cmgoglx2j0000l4040kcwwy3j cmgoglx2j0000l4040kcwwy3j --dry-run');
    process.exit(1);
  }

  console.log('🔄 Move Opportunities to Organization\n');
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Get target organization
    const targetOrg = await prisma.organization.findUnique({
      where: { id: targetOrgId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: { opportunities: true },
        },
      },
    });

    if (!targetOrg) {
      console.error(`❌ Target organization "${targetOrgId}" not found`);
      process.exit(1);
    }

    // Get new owner
    const newOwner = await prisma.user.findUnique({
      where: { id: newOwnerId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!newOwner) {
      console.error(`❌ New owner user "${newOwnerId}" not found`);
      process.exit(1);
    }

    if (newOwner.organizationId !== targetOrgId) {
      console.error(`❌ New owner "${newOwner.email}" is not in target organization "${targetOrg.name}"`);
      console.error(`   Owner org: ${newOwner.organization?.name || 'N/A'} (${newOwner.organizationId})`);
      process.exit(1);
    }

    // Get all opportunities NOT in the target organization
    const opportunitiesToMove = await prisma.opportunity.findMany({
      where: {
        NOT: {
          organizationId: targetOrgId,
        },
      },
      include: {
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log('📊 Migration Plan:');
    console.log('='.repeat(70));
    console.log(`\n🏢 Target organization:`);
    console.log(`   Name:              ${targetOrg.name}`);
    console.log(`   ID:                ${targetOrg.id}`);
    console.log(`   Current Opps:      ${targetOrg._count.opportunities}`);
    console.log(`   Users:             ${targetOrg.users.length}`);
    targetOrg.users.forEach(u => {
      console.log(`     - ${u.name} (${u.email})`);
    });

    console.log(`\n👤 New owner for opportunities:`);
    console.log(`   Name:              ${newOwner.name}`);
    console.log(`   Email:             ${newOwner.email}`);
    console.log(`   User ID:           ${newOwner.id}`);

    console.log(`\n📦 Opportunities to move: ${opportunitiesToMove.length}\n`);

    if (opportunitiesToMove.length === 0) {
      console.log('✅ All opportunities are already in the target organization!');
      return;
    }

    // Group by source organization
    const byOrg: Record<string, typeof opportunitiesToMove> = {};
    opportunitiesToMove.forEach(opp => {
      const orgId = opp.organizationId;
      if (!byOrg[orgId]) byOrg[orgId] = [];
      byOrg[orgId].push(opp);
    });

    Object.entries(byOrg).forEach(([orgId, opps]) => {
      const orgName = opps[0].organization?.name || 'Unknown';
      console.log(`From "${orgName}" (${orgId}):`);
      opps.forEach(opp => {
        console.log(`   ✓ ${opp.id}: ${opp.name} (owner: ${opp.owner.email})`);
      });
      console.log('');
    });

    if (!isDryRun) {
      console.log('🔄 Executing migration...\n');

      const result = await prisma.opportunity.updateMany({
        where: {
          NOT: {
            organizationId: targetOrgId,
          },
        },
        data: {
          organizationId: targetOrgId,
          ownerId: newOwnerId,
        },
      });

      console.log(`✅ Moved ${result.count} opportunities to ${targetOrg.name}`);
      console.log(`✅ Updated owner to ${newOwner.email}`);

      console.log('\n✅ Migration completed successfully!');
      console.log(`\nAll opportunities are now in organization "${targetOrg.name}"`);
      console.log(`Owned by "${newOwner.email}"`);

    } else {
      console.log('⚠️  DRY RUN MODE - No changes were applied');
      console.log('Run without --dry-run to apply these changes');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
