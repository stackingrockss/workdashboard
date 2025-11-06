import { PrismaClient } from "@prisma/client";
import { OpportunityStage } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * NOTE: With Supabase Auth enabled, users are created automatically when they sign up.
 * This seed script is kept for reference or testing purposes.
 * In production, each user will create their own opportunities and columns.
 *
 * To seed data for testing, you'll need to:
 * 1. Create a user via Supabase Auth
 * 2. Get the user's ID from the database
 * 3. Update the owner.id below to match that user's ID
 */

// Helper function to determine quarter column ID based on close date
function getQuarterColumnId(closeDate: Date): string {
  const month = closeDate.getMonth(); // 0-11
  const year = closeDate.getFullYear();

  // Determine quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
  const quarter = Math.floor(month / 3) + 1;

  return `col-q${quarter}-${year}`;
}

export async function seedDatabase() {
  console.log("🌱 Seeding database...");

  // Create user
  const owner = { id: "u1", email: "matt.seelig@example.com", name: "Matt Seelig" };

  console.log("Creating user...");
  await prisma.user.upsert({
    where: { id: owner.id },
    create: { id: owner.id, email: owner.email, name: owner.name },
    update: { email: owner.email, name: owner.name },
  });

  console.log("Creating default kanban columns...");
  const defaultColumns = [
    { id: "col-q1-2025", title: "Q1 2025", order: 0 },
    { id: "col-q2-2025", title: "Q2 2025", order: 1 },
    { id: "col-q3-2025", title: "Q3 2025", order: 2 },
    { id: "col-q4-2025", title: "Q4 2025", order: 3 },
    { id: "col-closed-lost", title: "Closed Lost", order: 4, color: "#ef4444" },
  ];

  for (const col of defaultColumns) {
    await prisma.kanbanColumn.upsert({
      where: { id: col.id },
      create: col,
      update: { title: col.title, order: col.order, color: col.color },
    });
  }

  console.log("Creating opportunities...");
  const today = new Date();
  const opportunities = [
    {
      id: "opp-001",
      name: "Claritev",
      accountName: "Claritev",
      amountArr: 85000,
      confidenceLevel: 4, // was 75%
      nextStep: "Final contract review",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 1, 15),
      stage: "negotiation" as OpportunityStage,
      columnId: getQuarterColumnId(new Date(today.getFullYear(), today.getMonth() + 1, 15)),
      ownerId: "u1",
    },
    {
      id: "opp-002",
      name: "InnovAge",
      accountName: "InnovAge",
      amountArr: 120000,
      confidenceLevel: 3, // was 60%
      nextStep: "Schedule technical demo",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 2, 1),
      stage: "qualification" as OpportunityStage,
      columnId: getQuarterColumnId(new Date(today.getFullYear(), today.getMonth() + 2, 1)),
      ownerId: "u1",
    },
    {
      id: "opp-003",
      name: "Loyal Source",
      accountName: "Loyal Source",
      amountArr: 95000,
      confidenceLevel: 4, // was 80%
      nextStep: "Send proposal",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 1, 30),
      stage: "proposal" as OpportunityStage,
      columnId: getQuarterColumnId(new Date(today.getFullYear(), today.getMonth() + 1, 30)),
      ownerId: "u1",
    },
    {
      id: "opp-004",
      name: "Apple",
      accountName: "Apple",
      amountArr: 250000,
      confidenceLevel: 2, // was 45%
      nextStep: "Discovery call with procurement",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 3, 10),
      stage: "prospect" as OpportunityStage,
      columnId: getQuarterColumnId(new Date(today.getFullYear(), today.getMonth() + 3, 10)),
      ownerId: "u1",
    },
    {
      id: "opp-005",
      name: "Defense Health Agency",
      accountName: "Defense Health Agency",
      amountArr: 180000,
      confidenceLevel: 4, // was 70%
      nextStep: "Security compliance review",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 2, 20),
      stage: "qualification" as OpportunityStage,
      columnId: getQuarterColumnId(new Date(today.getFullYear(), today.getMonth() + 2, 20)),
      ownerId: "u1",
    },
    {
      id: "opp-006",
      name: "SummaCare",
      accountName: "SummaCare",
      amountArr: 65000,
      confidenceLevel: 4, // was 85%
      nextStep: "Final approval meeting",
      closeDate: new Date(today.getFullYear(), today.getMonth(), 28),
      stage: "negotiation" as OpportunityStage,
      columnId: getQuarterColumnId(new Date(today.getFullYear(), today.getMonth(), 28)),
      ownerId: "u1",
    },
    {
      id: "opp-007",
      name: "Concentra",
      accountName: "Concentra",
      amountArr: 110000,
      confidenceLevel: 3, // was 55%
      nextStep: "Product demonstration",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 2, 15),
      stage: "qualification" as OpportunityStage,
      columnId: getQuarterColumnId(new Date(today.getFullYear(), today.getMonth() + 2, 15)),
      ownerId: "u1",
    },
    {
      id: "opp-008",
      name: "Premera",
      accountName: "Premera",
      amountArr: 140000,
      confidenceLevel: 3, // was 65%
      nextStep: "Draft MSA",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 1, 25),
      stage: "proposal" as OpportunityStage,
      columnId: getQuarterColumnId(new Date(today.getFullYear(), today.getMonth() + 1, 25)),
      ownerId: "u1",
    },
    {
      id: "opp-009",
      name: "CareFirst",
      accountName: "CareFirst",
      amountArr: 95000,
      confidenceLevel: 3, // was 50%
      nextStep: "Initial needs assessment",
      closeDate: new Date(today.getFullYear(), today.getMonth() + 3, 5),
      stage: "prospect" as OpportunityStage,
      columnId: getQuarterColumnId(new Date(today.getFullYear(), today.getMonth() + 3, 5)),
      ownerId: "u1",
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


