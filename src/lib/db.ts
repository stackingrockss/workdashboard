import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  secondaryPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Secondary Prisma client for backup database
 * Used for CDC (Change Data Capture) sync to keep a standby database in sync
 * Only created if SECONDARY_DATABASE_URL is configured
 */
export const getSecondaryPrisma = (): PrismaClient | null => {
  const secondaryUrl = process.env.SECONDARY_DATABASE_URL;

  if (!secondaryUrl) {
    return null;
  }

  if (globalForPrisma.secondaryPrisma) {
    return globalForPrisma.secondaryPrisma;
  }

  const secondaryClient = new PrismaClient({
    datasources: {
      db: {
        url: secondaryUrl,
      },
    },
    log: ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.secondaryPrisma = secondaryClient;
  }

  return secondaryClient;
};


