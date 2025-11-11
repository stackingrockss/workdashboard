// Check what data is actually in the parsed call
// DEVELOPMENT SCRIPT - DO NOT RUN IN PRODUCTION
import { PrismaClient } from '@prisma/client';

// Safety check - prevent running in production
if (process.env.NODE_ENV === 'production') {
  console.error('❌ This script should not run in production!');
  process.exit(1);
}

const prisma = new PrismaClient();

async function checkCallData() {
  // Find the most recent parsed call
  const recentCalls = await prisma.gongCall.findMany({
    where: { parsingStatus: 'completed' },
    orderBy: { parsedAt: 'desc' },
    take: 3,
  });

  if (recentCalls.length === 0) {
    console.error('No parsed calls found');
    return;
  }

  for (const call of recentCalls) {
    console.log('='.repeat(70));
    console.log(`Call: ${call.title}`);
    console.log(`Status: ${call.parsingStatus}`);
    console.log(`Parsed At: ${call.parsedAt}\n`);

    console.log('=== PARSED DATA ===');
    console.log('painPoints:', JSON.stringify(call.painPoints, null, 2));
    console.log('\ngoals:', JSON.stringify(call.goals, null, 2));
    console.log('\nnextSteps:', JSON.stringify(call.nextSteps, null, 2));
    console.log('\nparsedPeople:', JSON.stringify(call.parsedPeople, null, 2));

    console.log('\n=== RISK ASSESSMENT ===');
    if (call.riskAssessment) {
      console.log('✅ Risk Assessment exists:');
      console.log(JSON.stringify(call.riskAssessment, null, 2));
    } else {
      console.log('❌ No risk assessment found');
    }
    console.log('\n');
  }

  await prisma.$disconnect();
}

checkCallData().catch(console.error);
