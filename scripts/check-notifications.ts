import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  // Get all ContactsReadyNotifications
  const notifications = await prisma.contactsReadyNotification.findMany({
    select: {
      id: true,
      opportunityId: true,
      opportunityName: true,
      callTitle: true,
      contactCount: true,
      isRead: true,
      userId: true,
    },
  });

  console.log("All ContactsReadyNotification records:");
  console.log(JSON.stringify(notifications, null, 2));
  console.log("\nTotal:", notifications.length);

  // Get current user for comparison
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  console.log("\nUsers in system:");
  console.log(JSON.stringify(users, null, 2));
}

check().finally(() => prisma.$disconnect());
