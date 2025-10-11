import { PrismaClient } from "@prisma/client";
import { OpportunityStage } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log("🌱 Seeding database...");

  // Create users
  const owners = [
    { id: "u1", email: "alex@example.com", name: "Alex Johnson" },
    { id: "u2", email: "priya@example.com", name: "Priya Singh" },
    { id: "u3", email: "marco@example.com", name: "Marco Ruiz" },
  ];

  console.log("Creating users...");
  for (const o of owners) {
    await prisma.user.upsert({
      where: { id: o.id },
      create: { id: o.id, email: o.email, name: o.name },
      update: { email: o.email, name: o.name },
    });
  }

  console.log("Creating opportunities...");
  const today = new Date();
  const opportunities = [
    {
      id: "opp-001",
      name: "Renewal - Acme Corp",
      account: "Acme Corp",
      amountArr: 24000,
      probability: 70,
      nextStep: "Send updated MSA",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 1, 15),
      stage: "proposal" as OpportunityStage,
      ownerId: "u1",
    },
    {
      id: "opp-002",
      name: "New Biz - Globex",
      account: "Globex",
      amountArr: 54000,
      probability: 40,
      nextStep: "Schedule demo with CTO",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 2, 1),
      stage: "qualification" as OpportunityStage,
      ownerId: "u2",
    },
    {
      id: "opp-003",
      name: "Expansion - Initech",
      account: "Initech",
      amountArr: 120000,
      probability: 55,
      nextStep: "Draft proposal",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 1, 30),
      stage: "prospect" as OpportunityStage,
      ownerId: "u3",
    },
    {
      id: "opp-004",
      name: "New Biz - Hooli",
      account: "Hooli",
      amountArr: 36000,
      probability: 25,
      nextStep: "Intro call with VP Eng",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 3, 10),
      stage: "prospect" as OpportunityStage,
      ownerId: "u1",
    },
    {
      id: "opp-005",
      name: "New Biz - Umbrella",
      account: "Umbrella Co",
      amountArr: 84000,
      probability: 65,
      nextStep: "Security review",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 2, 20),
      stage: "negotiation" as OpportunityStage,
      ownerId: "u2",
    },
    {
      id: "opp-006",
      name: "Renewal - Soylent",
      account: "Soylent",
      amountArr: 18000,
      probability: 95,
      nextStep: "Book signature",
      closeDate: new Date(today.getFullYear(), today.getMonth(), 28),
      stage: "proposal" as OpportunityStage,
      ownerId: "u3",
    },
  ];

  for (const opp of opportunities) {
    await prisma.opportunity.upsert({
      where: { id: opp.id },
      create: opp,
      update: opp,
    });
  }

  console.log("✅ Database seeded successfully!");
}

seedDatabase()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


