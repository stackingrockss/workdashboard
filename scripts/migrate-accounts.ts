// Script to migrate account data after schema change
// This creates Account records from accountName field and links opportunities

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting account migration...');

  // Get all opportunities with accountName
  const opportunities = await prisma.opportunity.findMany({
    where: {
      accountName: { not: null },
      accountId: null,
    },
    select: {
      id: true,
      accountName: true,
    },
  });

  console.log(`Found ${opportunities.length} opportunities to migrate`);

  // Get unique account names
  const uniqueAccountNames = [...new Set(
    opportunities
      .map(opp => opp.accountName)
      .filter((name): name is string => name !== null)
  )];

  console.log(`Found ${uniqueAccountNames.length} unique account names`);

  // Create accounts
  for (const accountName of uniqueAccountNames) {
    try {
      await prisma.account.upsert({
        where: { name: accountName },
        update: {},
        create: {
          name: accountName,
          priority: 'medium',
          health: 'good',
        },
      });
      console.log(`Created/verified account: ${accountName}`);
    } catch (error) {
      console.error(`Error creating account ${accountName}:`, error);
    }
  }

  // Link opportunities to accounts
  for (const opp of opportunities) {
    if (!opp.accountName) continue;

    try {
      const account = await prisma.account.findUnique({
        where: { name: opp.accountName },
      });

      if (account) {
        await prisma.opportunity.update({
          where: { id: opp.id },
          data: { accountId: account.id },
        });
        console.log(`Linked opportunity ${opp.id} to account ${account.name}`);
      }
    } catch (error) {
      console.error(`Error linking opportunity ${opp.id}:`, error);
    }
  }

  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
