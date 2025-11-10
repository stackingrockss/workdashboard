// Quick diagnostic script to check GongCall parsing status
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkParsingStatus() {
  console.log('Checking GongCall parsing status...\n');

  const parsingCalls = await prisma.gongCall.findMany({
    where: {
      parsingStatus: 'parsing',
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  });

  console.log(`Found ${parsingCalls.length} calls stuck in 'parsing' status:\n`);

  for (const call of parsingCalls) {
    console.log(`ID: ${call.id}`);
    console.log(`Title: ${call.title}`);
    console.log(`Status: ${call.parsingStatus}`);
    console.log(`Error: ${call.parsingError || 'None'}`);
    console.log(`Parsed At: ${call.parsedAt || 'Not yet'}`);
    console.log(`Transcript Length: ${call.transcriptText?.length || 0} chars`);
    console.log(`Has painPoints: ${call.painPoints ? 'Yes' : 'No'}`);
    console.log(`Has goals: ${call.goals ? 'Yes' : 'No'}`);
    console.log(`Has nextSteps: ${call.nextSteps ? 'Yes' : 'No'}`);
    console.log(`Created: ${call.createdAt}`);
    console.log(`Updated: ${call.updatedAt}`);
    console.log('---\n');
  }

  await prisma.$disconnect();
}

checkParsingStatus().catch(console.error);