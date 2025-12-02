import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany({
    where: {
      name: {
        contains: "loyal",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
      organizationId: true,
    },
  });

  console.log('Accounts containing "loyal":');
  console.log(JSON.stringify(accounts, null, 2));
}

main().finally(() => prisma.$disconnect());
