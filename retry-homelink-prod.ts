// Retry HOMELINK parsing using production database connection
// Run with: DATABASE_URL="your_prod_db_url" npx tsx retry-homelink-prod.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function retryHomelinkParsing() {
  const callId = 'cmhsblt270001ks04vo4x6bfy'; // HOMELINK call

  console.log(`Resetting parsing status for call ${callId}...\n`);

  try {
    // Get the call
    const call = await prisma.gongCall.findUnique({
      where: { id: callId },
      select: {
        id: true,
        title: true,
        parsingStatus: true,
        meetingDate: true,
      },
    });

    if (!call) {
      console.error('❌ Call not found');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Found call: ${call.title}`);
    console.log(`Current Status: ${call.parsingStatus}`);
    console.log(`Meeting Date: ${call.meetingDate}\n`);

    // Reset to pending - Inngest will automatically retry
    const updated = await prisma.gongCall.update({
      where: { id: callId },
      data: {
        parsingStatus: 'pending',
        parsingError: null,
      },
    });

    console.log(`✅ Reset parsing status to: ${updated.parsingStatus}`);
    console.log('\nThe Inngest job should automatically pick this up and retry parsing.');
    console.log('Check your Inngest dashboard to monitor progress.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

retryHomelinkParsing().catch(console.error);
