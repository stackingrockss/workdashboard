// Check all stuck calls in production
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStuckCalls() {
  console.log('Checking for stuck parsing jobs...\n');

  const stuckCalls = await prisma.gongCall.findMany({
    where: {
      OR: [
        { parsingStatus: 'parsing' },
        { parsingStatus: 'pending' },
      ],
    },
    select: {
      id: true,
      title: true,
      parsingStatus: true,
      parsingError: true,
      meetingDate: true,
      transcriptText: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Found ${stuckCalls.length} calls in parsing/pending status:\n`);

  for (const call of stuckCalls) {
    console.log(`📞 ${call.title}`);
    console.log(`   ID: ${call.id}`);
    console.log(`   Status: ${call.parsingStatus}`);
    console.log(`   Meeting Date: ${call.meetingDate.toLocaleDateString()}`);
    console.log(`   Has Transcript: ${call.transcriptText ? `Yes (${call.transcriptText.length} chars)` : 'No'}`);
    console.log(`   Error: ${call.parsingError || 'None'}`);
    console.log(`   Created: ${call.createdAt.toLocaleString()}`);
    console.log(`   Updated: ${call.updatedAt.toLocaleString()}`);
    console.log('');
  }

  await prisma.$disconnect();
}

checkStuckCalls().catch(console.error);
