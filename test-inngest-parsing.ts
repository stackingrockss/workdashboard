// Test Inngest parsing by triggering a job for the stuck call
import { inngest } from './src/lib/inngest/client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testInngestParsing() {
  const callId = 'cmhsblt270001ks04vo4x6bfy';

  console.log(`Testing Inngest parsing for call ${callId}...\n`);

  // Get the call
  const call = await prisma.gongCall.findUnique({
    where: { id: callId },
  });

  if (!call) {
    console.error('❌ Call not found');
    return;
  }

  if (!call.transcriptText) {
    console.error('❌ No transcript text found');
    return;
  }

  console.log(`Call: ${call.title}`);
  console.log(`Transcript length: ${call.transcriptText.length} characters`);
  console.log(`Current status: ${call.parsingStatus}\n`);

  console.log('Sending job to Inngest...');

  try {
    // Send the parsing job to Inngest
    await inngest.send({
      name: 'gong/transcript.parse',
      data: {
        gongCallId: call.id,
        transcriptText: call.transcriptText,
      },
    });

    console.log('✅ Job queued successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the Inngest Dev Server: npx inngest-cli@latest dev');
    console.log('2. Start your Next.js dev server: npm run dev');
    console.log('3. Check the Inngest dashboard at http://localhost:8288');
    console.log('4. The job will process automatically and update the database');
  } catch (error) {
    console.error('❌ Failed to queue job:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testInngestParsing().catch(console.error);
