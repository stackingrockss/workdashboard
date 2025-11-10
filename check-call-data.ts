// Check what data is actually in the parsed call
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCallData() {
  const callId = 'cmhs5om5c0005la046w8p9wpx';

  const call = await prisma.gongCall.findUnique({
    where: { id: callId },
  });

  if (!call) {
    console.error('Call not found');
    return;
  }

  console.log(`Call: ${call.title}`);
  console.log(`Status: ${call.parsingStatus}`);
  console.log(`Parsed At: ${call.parsedAt}\n`);

  console.log('=== RAW DATA ===');
  console.log('painPoints:', JSON.stringify(call.painPoints, null, 2));
  console.log('\ngoals:', JSON.stringify(call.goals, null, 2));
  console.log('\nnextSteps:', JSON.stringify(call.nextSteps, null, 2));
  console.log('\nparsedPeople:', JSON.stringify(call.parsedPeople, null, 2));

  await prisma.$disconnect();
}

checkCallData().catch(console.error);