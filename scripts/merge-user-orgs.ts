/**
 * Merge User Organizations
 *
 * This script helps consolidate multiple user accounts/organizations into one.
 * Use this when you have seed data users and real Supabase auth users that should be in the same org.
 *
 * Usage:
 *   npx tsx scripts/merge-user-orgs.ts <target-org-id> <user-id-to-move> [--dry-run]
 *
 * Example:
 *   npx tsx scripts/merge-user-orgs.ts org-u1 cmgoglx2j0000l4040kcwwy3j --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const targetOrgId = args[0];
  const userIdToMove = args[1];

  if (!targetOrgId || !userIdToMove) {
    console.error('❌ Usage: npx tsx scripts/merge-user-orgs.ts <target-org-id> <user-id-to-move> [--dry-run]');
    console.error('\nExample: npx tsx scripts/merge-user-orgs.ts org-u1 cmgoglx2j0000l4040kcwwy3j --dry-run');
    process.exit(1);
  }

  console.log('🔄 User Organization Merge Tool\n');
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Get target organization
    const targetOrg = await prisma.organization.findUnique({
      where: { id: targetOrgId },
      include: {
        _count: {
          select: { users: true, opportunities: true },
        },
      },
    });

    if (!targetOrg) {
      console.error(`❌ Target organization "${targetOrgId}" not found`);
      process.exit(1);
    }

    // Get user to move
    const userToMove = await prisma.user.findUnique({
      where: { id: userIdToMove },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        opportunities: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!userToMove) {
      console.error(`❌ User "${userIdToMove}" not found`);
      process.exit(1);
    }

    console.log('📊 Migration Plan:');
    console.log('='.repeat(70));
    console.log(`\n👤 User to move:`);
    console.log(`   Name:         ${userToMove.name}`);
    console.log(`   Email:        ${userToMove.email}`);
    console.log(`   User ID:      ${userToMove.id}`);
    console.log(`   Supabase ID:  ${userToMove.supabaseId || 'N/A'}`);
    console.log(`   Current Org:  ${userToMove.organization?.name || 'N/A'} (${userToMove.organization?.id || 'N/A'})`);
    console.log(`   Opportunities: ${userToMove.opportunities.length}`);

    console.log(`\n🏢 Target organization:`);
    console.log(`   Name:         ${targetOrg.name}`);
    console.log(`   ID:           ${targetOrg.id}`);
    console.log(`   Current Users: ${targetOrg._count.users}`);
    console.log(`   Opportunities: ${targetOrg._count.opportunities}`);

    console.log(`\n✨ Actions to perform:`);
    console.log(`   1. Move user "${userToMove.email}" to organization "${targetOrg.name}"`);

    if (userToMove.opportunities.length > 0) {
      console.log(`   2. Move ${userToMove.opportunities.length} opportunities to target organization:`);
      userToMove.opportunities.forEach(opp => {
        console.log(`      - ${opp.id}: ${opp.name}`);
      });
    }

    const oldOrgId = userToMove.organization?.id;
    if (oldOrgId !== targetOrgId) {
      // Check if old org will be empty
      const oldOrg = await prisma.organization.findUnique({
        where: { id: oldOrgId },
        include: {
          _count: {
            select: { users: true, opportunities: true },
          },
        },
      });

      if (oldOrg && oldOrg._count.users === 1 && oldOrg._count.opportunities === userToMove.opportunities.length) {
        console.log(`   3. Delete empty organization "${oldOrg.name}" (${oldOrgId})`);
      }
    }

    if (!isDryRun) {
      console.log('\n🔄 Executing migration...\n');

      // 1. Move user to target organization
      await prisma.user.update({
        where: { id: userIdToMove },
        data: { organizationId: targetOrgId },
      });
      console.log(`✅ Moved user to ${targetOrg.name}`);

      // 2. Move user's opportunities to target organization
      if (userToMove.opportunities.length > 0) {
        await prisma.opportunity.updateMany({
          where: { ownerId: userIdToMove },
          data: { organizationId: targetOrgId },
        });
        console.log(`✅ Moved ${userToMove.opportunities.length} opportunities to ${targetOrg.name}`);
      }

      // 3. Clean up empty organization if needed
      if (oldOrgId !== targetOrgId) {
        const oldOrg = await prisma.organization.findUnique({
          where: { id: oldOrgId },
          include: {
            _count: {
              select: { users: true, opportunities: true, accounts: true, kanbanViews: true },
            },
          },
        });

        if (oldOrg && oldOrg._count.users === 0 && oldOrg._count.opportunities === 0 && oldOrg._count.accounts === 0 && oldOrg._count.kanbanViews === 0) {
          await prisma.organization.delete({
            where: { id: oldOrgId },
          });
          console.log(`✅ Deleted empty organization "${oldOrg.name}"`);
        }
      }

      console.log('\n✅ Migration completed successfully!');
      console.log(`\nUser "${userToMove.email}" is now in organization "${targetOrg.name}"`);
      console.log('They can now access all opportunities in that organization.');

    } else {
      console.log('\n⚠️  DRY RUN MODE - No changes were applied');
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
