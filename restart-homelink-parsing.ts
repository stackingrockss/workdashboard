// Restart parsing for the stuck HOMELINK call
import { PrismaClient } from '@prisma/client';
import { parseGongTranscript } from './src/lib/ai/parse-gong-transcript';
import { appendToOpportunityHistory } from './src/lib/utils/gong-history';

const prisma = new PrismaClient();

async function restartParsing() {
  const callId = 'cmhsblt270001ks04vo4x6bfy'; // HOMELINK / The VGM Group call

  console.log(`Restarting parsing for call ${callId}...\n`);

  // Get the call
  const call = await prisma.gongCall.findUnique({
    where: { id: callId },
    include: { opportunity: true },
  });

  if (!call) {
    console.error('❌ Call not found');
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Found call: ${call.title}`);
  console.log(`Call ID: ${call.id}`);
  console.log(`Current Status: ${call.parsingStatus}`);
  console.log(`Meeting Date: ${call.meetingDate}`);
  console.log(`Transcript length: ${call.transcriptText?.length || 0} characters`);
  console.log(`Opportunity: ${call.opportunity?.name || 'N/A'}\n`);

  if (!call.transcriptText) {
    console.error('❌ No transcript text found');
    await prisma.$disconnect();
    return;
  }

  console.log('Starting AI parsing...\n');

  try {
    // Mark as parsing
    await prisma.gongCall.update({
      where: { id: call.id },
      data: {
        parsingStatus: 'parsing',
        parsingError: null,
      },
    });

    // Parse the transcript
    const result = await parseGongTranscript(call.transcriptText);

    if (result.success && result.data) {
      console.log('✅ Parsing successful!');
      console.log(`Pain Points: ${result.data.painPoints.length}`);
      console.log(`Goals: ${result.data.goals.length}`);
      console.log(`People: ${result.data.people.length}`);
      console.log(`Next Steps: ${result.data.nextSteps.length}\n`);

      // Update the call with results
      await prisma.gongCall.update({
        where: { id: call.id },
        data: {
          painPoints: JSON.parse(JSON.stringify(result.data.painPoints)),
          goals: JSON.parse(JSON.stringify(result.data.goals)),
          parsedPeople: JSON.parse(JSON.stringify(result.data.people)),
          nextSteps: JSON.parse(JSON.stringify(result.data.nextSteps)),
          parsedAt: new Date(),
          parsingStatus: 'completed',
          parsingError: null,
        },
      });

      console.log('✅ Updated GongCall with parsed results');

      // Update opportunity history
      if (call.opportunityId) {
        try {
          await appendToOpportunityHistory({
            opportunityId: call.opportunityId,
            gongCallId: call.id,
            meetingDate: call.meetingDate,
            painPoints: result.data.painPoints,
            goals: result.data.goals,
            nextSteps: result.data.nextSteps,
          });
          console.log('✅ Updated opportunity history');
        } catch (historyError) {
          console.error('❌ Failed to update opportunity history:', historyError);
        }
      }

      console.log('\n✅ Parsing complete!');
    } else {
      console.error('❌ Parsing failed:', result.error);
      await prisma.gongCall.update({
        where: { id: call.id },
        data: {
          parsingStatus: 'failed',
          parsingError: result.error || 'Unknown parsing error',
        },
      });
    }
  } catch (error) {
    console.error('❌ Error during parsing:', error);
    await prisma.gongCall.update({
      where: { id: call.id },
      data: {
        parsingStatus: 'failed',
        parsingError: error instanceof Error ? error.message : 'Unexpected error',
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

restartParsing().catch(console.error);
