// Fix the stuck call that actually has results
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixStuckCall() {
  const callId = 'cmhs5om5c0005la046w8p9wpx';

  console.log(`Fixing stuck call ${callId}...`);

  const updated = await prisma.gongCall.update({
    where: { id: callId },
    data: {
      parsingStatus: 'completed',
    },
  });

  console.log(`✅ Updated call status to: ${updated.parsingStatus}`);
  console.log(`Has painPoints: ${updated.painPoints ? 'Yes' : 'No'}`);
  console.log(`Has goals: ${updated.goals ? 'Yes' : 'No'}`);
  console.log(`Has nextSteps: ${updated.nextSteps ? 'Yes' : 'No'}`);

  await prisma.$disconnect();
}

fixStuckCall().catch(console.error);