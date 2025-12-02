import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const verifiableOrgId = "org-cmgoglx2j0000l4040kcwwy3j";

  console.log("=== Opportunities in Verifiable ===\n");

  const opportunities = await prisma.opportunity.findMany({
    where: { organizationId: verifiableOrgId },
    select: {
      id: true,
      name: true,
      accountId: true,
      accountName: true,
      account: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log("Opportunity | accountId | accountName | Linked Account");
  console.log("-".repeat(80));

  for (const opp of opportunities) {
    const linkedAccount = opp.account ? opp.account.name : "(none)";
    console.log(
      `${opp.name.padEnd(30)} | ${(opp.accountId || "NULL").padEnd(30)} | ${(opp.accountName || "NULL").padEnd(20)} | ${linkedAccount}`
    );
  }

  // Count with/without accounts
  const withAccount = opportunities.filter((o) => o.accountId).length;
  const withoutAccount = opportunities.filter((o) => !o.accountId).length;

  console.log(`\nSummary:`);
  console.log(`  With account linked: ${withAccount}`);
  console.log(`  Without account linked: ${withoutAccount}`);

  // Check the schema - is accountId required?
  console.log(`\n=== Schema Check ===`);
  console.log(`accountId field is OPTIONAL in Opportunity model (String?)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
