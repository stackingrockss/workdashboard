// Trigger risk analysis via API for calls missing it
// This bypasses Inngest and calls the API directly to debug issues
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Set your production URL here or use localhost for local testing
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function triggerRiskAnalysis() {
  console.log('Finding calls that need risk analysis...\n');

  // Find completed calls without risk assessment
  const allParsedCalls = await prisma.gongCall.findMany({
    where: {
      parsingStatus: 'completed',
      transcriptText: { not: null },
    },
    orderBy: { parsedAt: 'desc' },
    take: 10,
  });

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
    console.log(`Making API request to ${API_BASE_URL}/api/v1/gong-calls/${call.id}/analyze-risk\n`);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/gong-calls/${call.id}/analyze-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Risk analysis successful!');
        console.log(`Risk Level: ${data.riskAssessment.riskLevel}`);
        console.log(`Risk Factors: ${data.riskAssessment.riskFactors.length}`);
        console.log(`Recommended Actions: ${data.riskAssessment.recommendedActions.length}\n`);
      } else {
        console.error('❌ API request failed:');
        console.error('Status:', response.status);
        console.error('Error:', data.error);
        console.error('Details:', data.details);
        console.log('');
      }
    } catch (error) {
      console.error('❌ Error making API request:', error);
      console.log('');
    }

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✅ Risk analysis complete!');
  await prisma.$disconnect();
}

triggerRiskAnalysis().catch(console.error);