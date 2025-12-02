import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const verifiableOrgId = "org-cmgoglx2j0000l4040kcwwy3j";
  const mattOrgId = "org-u1";

  console.log("=== Cross-Organization Account Check ===\n");

  const opportunities = await prisma.opportunity.findMany({
    where: { organizationId: verifiableOrgId },
    select: {
      id: true,
      name: true,
      organizationId: true,
      accountId: true,
      account: {
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      },
    },
  });

  console.log("Checking if opportunities link to accounts in DIFFERENT orgs...\n");

  let crossOrgCount = 0;
  for (const opp of opportunities) {
    if (opp.account && opp.account.organizationId !== opp.organizationId) {
      crossOrgCount++;
      console.log(`CROSS-ORG LINK FOUND:`);
      console.log(`  Opportunity: ${opp.name} (org: ${opp.organizationId})`);
      console.log(`  Account: ${opp.account.name} (org: ${opp.account.organizationId})`);
      console.log();
    }
  }

  if (crossOrgCount === 0) {
    console.log("No cross-org links found. All opportunities link to accounts in the same org.");
  }

  // Now let's see the actual accounts in Verifiable
  console.log("\n=== Accounts in Verifiable org ===");
  const verifiableAccounts = await prisma.account.findMany({
    where: { organizationId: verifiableOrgId },
    select: { id: true, name: true },
  });
  console.log(verifiableAccounts.map((a) => `${a.name} (${a.id})`).join("\n"));

  console.log("\n=== Accounts in Matt Seelig's org ===");
  const mattAccounts = await prisma.account.findMany({
    where: { organizationId: mattOrgId },
    select: { id: true, name: true },
  });
  console.log(mattAccounts.map((a) => `${a.name} (${a.id})`).join("\n"));

  // Check which account IDs the opportunities use
  console.log("\n=== Account IDs used by Verifiable opportunities ===");
  const usedAccountIds = [...new Set(opportunities.map((o) => o.accountId).filter(Boolean))];
  console.log(usedAccountIds.join("\n"));

  // Check if any of these IDs are in Matt's org
  console.log("\n=== Checking if any opportunity account IDs are from Matt's org ===");
  const mattAccountIds = mattAccounts.map((a) => a.id);
  const crossOrgIds = usedAccountIds.filter((id) => mattAccountIds.includes(id!));
  if (crossOrgIds.length > 0) {
    console.log("FOUND cross-org account references:", crossOrgIds);
  } else {
    console.log("No cross-org references found.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
