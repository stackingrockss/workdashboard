// Reset both HOMELINK calls and trigger parsing via Inngest
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const callIds = [
  { id: 'cmhskn6170001jy044kr35b47', title: 'HOMELINK - Intro (Oct 28)' },
  { id: 'cmhsblt270001ks04vo4x6bfy', title: 'HOMELINK - Demo (Oct 24)' },
];

async function resetAndTrigger() {
  console.log('Resetting both HOMELINK calls to trigger fresh parsing...\n');

  for (const call of callIds) {
    console.log(`📞 ${call.title}`);
    console.log(`   ID: ${call.id}`);

    try {
      // Get the call with transcript
      const gongCall = await prisma.gongCall.findUnique({
        where: { id: call.id },
        select: {
          id: true,
          transcriptText: true,
          parsingStatus: true,
        },
      });

      if (!gongCall) {
        console.log(`   ❌ Call not found\n`);
        continue;
      }

      if (!gongCall.transcriptText) {
        console.log(`   ❌ No transcript text\n`);
        continue;
      }

      // Reset to pending status
      await prisma.gongCall.update({
        where: { id: call.id },
        data: {
          parsingStatus: 'pending',
          parsingError: null,
        },
      });

      console.log(`   ✅ Reset to pending`);
      console.log(`   Transcript: ${gongCall.transcriptText.length} characters\n`);
    } catch (error) {
      console.log(`   ❌ Error:`, error instanceof Error ? error.message : error);
      console.log('');
    }
  }

  await prisma.$disconnect();

  console.log('✅ Both calls reset to pending.');
  console.log('\nNow trigger them via the production API:');
  console.log('curl -X POST https://workdashboard.vercel.app/api/v1/gong-calls/cmhskn6170001jy044kr35b47/retry-parsing');
  console.log('curl -X POST https://workdashboard.vercel.app/api/v1/gong-calls/cmhsblt270001ks04vo4x6bfy/retry-parsing');
}

resetAndTrigger().catch(console.error);
