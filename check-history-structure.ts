// Check the exact structure of history fields
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStructure() {
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
      painPointsHistory: true,
    },
  });

  if (!opportunity?.painPointsHistory) {
    console.error('No pain points history');
    return;
  }

  console.log('=== RAW PAIN POINTS HISTORY ===');
  console.log(opportunity.painPointsHistory);
  console.log('\n=== DIVIDER LOCATION ===');
  const dividerIndex = opportunity.painPointsHistory.indexOf('--- Auto-generated from calls ---');
  console.log(`Divider at position: ${dividerIndex}`);

  if (dividerIndex > 0) {
    console.log('\n=== BEFORE DIVIDER (Manual Notes) ===');
    console.log(opportunity.painPointsHistory.substring(0, dividerIndex));
    console.log('\n=== AFTER DIVIDER (Auto-Generated) ===');
    console.log(opportunity.painPointsHistory.substring(dividerIndex));
  }

  await prisma.$disconnect();
}

checkStructure().catch(console.error);
