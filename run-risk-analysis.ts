// Manually run risk analysis for calls missing it
import { PrismaClient } from '@prisma/client';
import { analyzeCallRisk } from './src/lib/ai/analyze-call-risk';

const prisma = new PrismaClient();

async function runRiskAnalysis() {
  console.log('Finding calls that need risk analysis...\n');

  // Find completed calls (can't filter riskAssessment in where clause for JSON fields)
  const allParsedCalls = await prisma.gongCall.findMany({
    where: {
      parsingStatus: 'completed',
      transcriptText: { not: null },
    },
    orderBy: { parsedAt: 'desc' },
    take: 10,
  });

  // Filter for calls that actually don't have risk assessment
  const callsNeedingRisk = allParsedCalls.filter(call => !call.riskAssessment);

  if (callsNeedingRisk.length === 0) {
    console.log('No calls need risk analysis - all up to date!');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${callsNeedingRisk.length} call(s) needing risk analysis:\n`);

  for (const call of callsNeedingRisk) {
    console.log('='.repeat(70));
    console.log(`Call: ${call.title}`);
    console.log(`ID: ${call.id}`);
    console.log(`Transcript length: ${call.transcriptText?.length} characters`);
    console.log(`Running risk analysis...\n`);

    try {
      const result = await analyzeCallRisk(call.transcriptText!);

      if (result.success && result.data) {
        console.log('✅ Risk analysis successful!');
        console.log(`Risk Level: ${result.data.riskLevel}`);
        console.log(`Risk Factors: ${result.data.riskFactors.length}`);
        console.log(`Recommended Actions: ${result.data.recommendedActions.length}`);

        // Update the call with risk assessment
        await prisma.gongCall.update({
          where: { id: call.id },
          data: {
            riskAssessment: JSON.parse(JSON.stringify(result.data)),
          },
        });

        console.log('✅ Saved risk assessment to database\n');
      } else {
        console.error('❌ Risk analysis failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error during risk analysis:', error);
    }
  }

  console.log('\n✅ Risk analysis complete!');
  await prisma.$disconnect();
}

runRiskAnalysis().catch(console.error);
