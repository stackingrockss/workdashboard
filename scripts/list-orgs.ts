import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true },
  });
  console.log("All organizations:");
  orgs.forEach((o) => console.log(`  ${o.id} - ${o.name}`));
}

main()
  .finally(() => prisma.$disconnect());
