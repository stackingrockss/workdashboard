// Check completed HOMELINK calls
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCompleted() {
  const calls = await prisma.gongCall.findMany({
    where: {
      title: {
        contains: 'HOMELINK',
      },
    },
    select: {
      id: true,
      title: true,
      parsingStatus: true,
      parsingError: true,
      painPoints: true,
      goals: true,
      parsedPeople: true,
      nextSteps: true,
      parsedAt: true,
      meetingDate: true,
    },
    orderBy: {
      meetingDate: 'desc',
    },
  });

  console.log(`Found ${calls.length} HOMELINK calls:\n`);

  for (const call of calls) {
    console.log(`📞 ${call.title}`);
    console.log(`   Status: ${call.parsingStatus}`);
    console.log(`   Meeting Date: ${call.meetingDate.toLocaleDateString()}`);

    if (call.parsingStatus === 'completed') {
      console.log(`   ✅ Pain Points: ${Array.isArray(call.painPoints) ? call.painPoints.length : 0}`);
      console.log(`   ✅ Goals: ${Array.isArray(call.goals) ? call.goals.length : 0}`);
      console.log(`   ✅ People: ${Array.isArray(call.parsedPeople) ? call.parsedPeople.length : 0}`);
      console.log(`   ✅ Next Steps: ${Array.isArray(call.nextSteps) ? call.nextSteps.length : 0}`);
      console.log(`   ✅ Parsed At: ${call.parsedAt?.toLocaleString()}`);
    } else if (call.parsingStatus === 'failed') {
      console.log(`   ❌ Error: ${call.parsingError}`);
    } else {
      console.log(`   ⏳ Still processing...`);
    }

    console.log('');
  }

  await prisma.$disconnect();
}

checkCompleted().catch(console.error);
