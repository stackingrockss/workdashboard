/**
 * Check all users and their organizations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('👥 All Users and Organizations:\n');

  try {
    const users = await prisma.user.findMany({
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
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Total users: ${users.length}\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   User ID:         ${user.id}`);
      console.log(`   Supabase ID:     ${user.supabaseId || 'N/A'}`);
      console.log(`   Organization:    ${user.organization.name} (${user.organization.id})`);
      console.log(`   Role:            ${user.role}`);
      console.log(`   Opportunities:   ${user.opportunities.length}`);
      if (user.opportunities.length > 0) {
        user.opportunities.forEach(opp => {
          console.log(`     - ${opp.id}: ${opp.name}`);
        });
      }
      console.log('');
    });

    // Show organizations
    console.log('\n🏢 All Organizations:\n');
    const orgs = await prisma.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            opportunities: true,
          },
        },
      },
    });

    orgs.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name} (${org.id})`);
      console.log(`   Users:          ${org._count.users}`);
      console.log(`   Opportunities:  ${org._count.opportunities}`);
      console.log(`   Domain:         ${org.domain || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('\n❌ Error:', error);
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
