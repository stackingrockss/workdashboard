import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedFromMocks() {
  const owners = [
    { id: "u1", email: "alex@example.com", name: "Alex Johnson" },
    { id: "u2", email: "priya@example.com", name: "Priya Singh" },
    { id: "u3", email: "marco@example.com", name: "Marco Ruiz" },
  ];
  for (const o of owners) {
    await prisma.user.upsert({
      where: { id: o.id },
      create: { id: o.id, email: o.email, name: o.name },
      update: { email: o.email, name: o.name },
    });
  }
}


