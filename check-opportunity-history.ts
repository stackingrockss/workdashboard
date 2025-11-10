// Check if opportunity history fields were updated
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOpportunityHistory() {
  // Get the opportunity ID from the GongCall
  const call = await prisma.gongCall.findUnique({
    where: { id: 'cmhs5om5c0005la046w8p9wpx' },
    select: { opportunityId: true },
  });

  if (!call) {
    console.error('Call not found');
    return;
  }

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: call.opportunityId },
    select: {
      id: true,
      name: true,
      painPointsHistory: true,
      goalsHistory: true,
      nextStepsHistory: true,
    },
  });

  if (!opportunity) {
    console.error('Opportunity not found');
    return;
  }

  console.log(`Opportunity: ${opportunity.name}\n`);
  console.log('=== HISTORY FIELDS ===');
  console.log('\nPain Points History:');
  console.log(opportunity.painPointsHistory || '(null)');
  console.log('\nGoals History:');
  console.log(opportunity.goalsHistory || '(null)');
  console.log('\nNext Steps History:');
  console.log(opportunity.nextStepsHistory || '(null)');

  await prisma.$disconnect();
}

checkOpportunityHistory().catch(console.error);
