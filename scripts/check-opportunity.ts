/**
 * Check a specific opportunity and its organization details
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const opportunityId = process.argv[2] || 'opp-003';

  console.log(`🔍 Checking opportunity: ${opportunityId}\n`);

  try {
    // Get the opportunity with all relations
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!opportunity) {
      console.log(`❌ Opportunity "${opportunityId}" not found in database\n`);
      console.log('Available opportunities:');
      const allOpps = await prisma.opportunity.findMany({
        select: { id: true, name: true },
        take: 10,
      });
      allOpps.forEach(opp => console.log(`  - ${opp.id}: ${opp.name}`));
      return;
    }

    console.log('📊 Opportunity Details:');
    console.log('='.repeat(60));
    console.log(`ID:               ${opportunity.id}`);
    console.log(`Name:             ${opportunity.name}`);
    console.log(`Organization ID:  ${opportunity.organizationId}`);
    console.log(`Organization:     ${opportunity.organization.name} (${opportunity.organization.id})`);
    console.log('\n👤 Owner Details:');
    console.log('='.repeat(60));
    console.log(`Owner ID:         ${opportunity.ownerId}`);
    console.log(`Owner Name:       ${opportunity.owner.name}`);
    console.log(`Owner Email:      ${opportunity.owner.email}`);
    console.log(`Owner Org ID:     ${opportunity.owner.organizationId}`);
    console.log(`Owner Org:        ${opportunity.owner.organization.name} (${opportunity.owner.organization.id})`);
    console.log('\n✅ Match Check:');
    console.log('='.repeat(60));

    if (opportunity.organizationId === opportunity.owner.organizationId) {
      console.log('✅ Organization IDs MATCH - Data is correct!');
    } else {
      console.log('❌ Organization IDs DO NOT MATCH:');
      console.log(`   Opportunity org: ${opportunity.organizationId}`);
      console.log(`   Owner org:       ${opportunity.owner.organizationId}`);
    }

    // Check how many users are in the organization
    const orgUserCount = await prisma.user.count({
      where: { organizationId: opportunity.organizationId },
    });
    console.log(`\n👥 Users in organization: ${orgUserCount}`);

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
