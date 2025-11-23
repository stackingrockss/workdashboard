// scripts/debug-risk-check.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking all Gong calls...\n");

  const allCalls = await prisma.gongCall.findMany({
    where: {
      parsingStatus: "completed",
    },
    select: {
      id: true,
      title: true,
      riskAssessment: true,
    },
  });

  console.log(`Total completed calls: ${allCalls.length}\n`);

  allCalls.forEach((call) => {
    console.log(`Call: ${call.title}`);
    console.log(`ID: ${call.id}`);
    console.log(`riskAssessment type: ${typeof call.riskAssessment}`);
    console.log(`riskAssessment value: ${JSON.stringify(call.riskAssessment, null, 2)}`);
    console.log(`Is null? ${call.riskAssessment === null}`);
    console.log(`Is undefined? ${call.riskAssessment === undefined}`);
    console.log("---");
  });

  // Test query with equals null
  const callsWithNull = await prisma.gongCall.findMany({
    where: {
      parsingStatus: "completed",
      riskAssessment: { equals: null },
    },
  });
  console.log(`\nCalls with riskAssessment equals null: ${callsWithNull.length}`);

  // Test without riskAssessment filter
  const callsCompleted = await prisma.gongCall.findMany({
    where: {
      parsingStatus: "completed",
    },
  });
  console.log(`Calls with parsingStatus completed: ${callsCompleted.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
