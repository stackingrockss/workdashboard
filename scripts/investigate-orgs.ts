import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Organization Investigation ===\n");

  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      domain: true,
      createdAt: true,
      _count: {
        select: {
          users: true,
          accounts: true,
          opportunities: true,
          kanbanViews: true,
          invitations: true,
        },
      },
    },
  });

  for (const org of orgs) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Organization: ${org.name}`);
    console.log(`ID: ${org.id}`);
    console.log(`Domain: ${org.domain || "(none)"}`);
    console.log(`Created: ${org.createdAt.toISOString()}`);
    console.log(`\nCounts:`);
    console.log(`  Users: ${org._count.users}`);
    console.log(`  Accounts: ${org._count.accounts}`);
    console.log(`  Opportunities: ${org._count.opportunities}`);
    console.log(`  Kanban Views: ${org._count.kanbanViews}`);
    console.log(`  Invitations: ${org._count.invitations}`);

    // Get users in this org
    const users = await prisma.user.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    console.log(`\nUsers:`);
    for (const user of users) {
      console.log(`  - ${user.email} (${user.name || "no name"}) - ${user.role}`);
    }

    // Get accounts
    const accounts = await prisma.account.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            opportunities: true,
            contacts: true,
          },
        },
      },
      take: 10,
    });

    console.log(`\nAccounts (first 10):`);
    for (const account of accounts) {
      console.log(
        `  - ${account.name} (${account._count.opportunities} opps, ${account._count.contacts} contacts)`
      );
    }

    // Get opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: { organizationId: org.id },
      select: {
        id: true,
        name: true,
        amountArr: true,
        stage: true,
      },
      take: 10,
    });

    console.log(`\nOpportunities (first 10):`);
    for (const opp of opportunities) {
      console.log(`  - ${opp.name} ($${opp.amountArr.toLocaleString()}) - ${opp.stage}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("\nSUMMARY:");
  for (const org of orgs) {
    console.log(
      `  ${org.name}: ${org._count.users} users, ${org._count.accounts} accounts, ${org._count.opportunities} opportunities`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
