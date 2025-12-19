// src/lib/inngest/functions/sync-database-backup.ts
// CDC (Change Data Capture) sync to backup database
// Syncs changed records from primary to secondary database every 12 hours

import { inngest } from "@/lib/inngest/client";
import { prisma, getSecondaryPrisma } from "@/lib/db";

// Models to sync in dependency order (parents before children)
// This ensures foreign key constraints are satisfied
const SYNC_ORDER = [
  "organization",
  "user",
  "account",
  "opportunity",
  "contact",
  "kanbanView",
  "kanbanColumn",
  "gongCall",
  "granolaNote",
  "googleNote",
  "calendarEvent",
  "task",
  "taskList",
  "chatMessage",
  "comment",
  "commentMention",
  "commentReaction",
  "invitation",
  "oauthToken",
  "calendarSyncState",
  "secFiling",
  "earningsCallTranscript",
  "organizationSettings",
  "gongIntegration",
  "mutualActionPlan",
  "content",
  "contactsReadyNotification",
  "parsingCompleteNotification",
  "accountResearchNotification",
  "secCompanyCache",
] as const;

type SyncableModel = (typeof SYNC_ORDER)[number];

// Track sync state in a simple key-value store (we'll use the secondary DB itself)
interface SyncState {
  lastSyncAt: Date;
  modelsProcessed: string[];
  recordsSynced: number;
  errors: Array<{ model: string; error: string }>;
}

/**
 * Database backup sync job
 * Runs every 12 hours to sync changed records to secondary database
 */
export const syncDatabaseBackupJob = inngest.createFunction(
  {
    id: "sync-database-backup",
    name: "Sync Database to Backup",
    retries: 2,
    concurrency: {
      limit: 1, // Only one sync at a time
    },
  },
  { cron: "0 */12 * * *" }, // Every 12 hours
  async ({ step, logger }) => {
    const secondaryPrisma = getSecondaryPrisma();

    if (!secondaryPrisma) {
      logger.warn("Secondary database not configured (SECONDARY_DATABASE_URL missing)");
      return {
        success: false,
        error: "Secondary database not configured",
      };
    }

    // Get the last sync timestamp (default to 12 hours ago for first run)
    const lastSyncAtStr = await step.run("get-last-sync-time", async () => {
      // For simplicity, we'll sync records updated in the last 13 hours
      // (1 hour buffer to handle edge cases)
      const thirteenHoursAgo = new Date();
      thirteenHoursAgo.setHours(thirteenHoursAgo.getHours() - 13);
      return thirteenHoursAgo.toISOString();
    });

    const lastSyncAt = new Date(lastSyncAtStr);

    const syncResults: SyncState = {
      lastSyncAt: new Date(),
      modelsProcessed: [],
      recordsSynced: 0,
      errors: [],
    };

    // Sync each model in order
    for (const modelName of SYNC_ORDER) {
      const result = await step.run(`sync-${modelName}`, async () => {
        try {
          const count = await syncModel(modelName, lastSyncAt, secondaryPrisma);
          return { success: true, count };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to sync ${modelName}: ${errorMessage}`);
          return { success: false, error: errorMessage, count: 0 };
        }
      });

      if (result.success) {
        syncResults.modelsProcessed.push(modelName);
        syncResults.recordsSynced += result.count;
      } else {
        syncResults.errors.push({
          model: modelName,
          error: "error" in result ? result.error : "Unknown error",
        });
      }
    }

    return {
      success: syncResults.errors.length === 0,
      ...syncResults,
    };
  }
);

/**
 * Sync a single model's changed records to secondary database
 */
async function syncModel(
  modelName: SyncableModel,
  since: Date,
  secondaryPrisma: ReturnType<typeof getSecondaryPrisma>
): Promise<number> {
  if (!secondaryPrisma) return 0;

  // Get changed records from primary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryModel = (prisma as any)[modelName];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const secondaryModel = (secondaryPrisma as any)[modelName];

  if (!primaryModel || !secondaryModel) {
    console.warn(`Model ${modelName} not found in Prisma client`);
    return 0;
  }

  // Check if model has updatedAt field by trying a query
  let records;
  try {
    records = await primaryModel.findMany({
      where: {
        updatedAt: { gte: since },
      },
    });
  } catch {
    // Model doesn't have updatedAt, skip incremental sync
    // These models will need a full sync approach
    console.log(`Model ${modelName} doesn't have updatedAt, skipping incremental sync`);
    return 0;
  }

  if (records.length === 0) {
    return 0;
  }

  // Upsert each record to secondary database
  let syncedCount = 0;
  for (const record of records) {
    try {
      await secondaryModel.upsert({
        where: { id: record.id },
        update: record,
        create: record,
      });
      syncedCount++;
    } catch (error) {
      // Log but continue - some records may fail due to FK constraints
      console.error(`Failed to sync ${modelName} record ${record.id}:`, error);
    }
  }

  return syncedCount;
}

/**
 * Manual full sync job - for initial sync or recovery
 * This should be triggered manually, not on a schedule
 */
export const fullDatabaseSyncJob = inngest.createFunction(
  {
    id: "full-database-sync",
    name: "Full Database Sync to Backup",
    retries: 1,
    concurrency: {
      limit: 1,
    },
  },
  { event: "database/full-sync.requested" },
  async ({ step, logger }) => {
    const secondaryPrisma = getSecondaryPrisma();

    if (!secondaryPrisma) {
      logger.warn("Secondary database not configured");
      return { success: false, error: "Secondary database not configured" };
    }

    const syncResults = {
      modelsProcessed: [] as string[],
      recordsSynced: 0,
      errors: [] as Array<{ model: string; error: string }>,
    };

    // Full sync each model in order
    for (const modelName of SYNC_ORDER) {
      const result = await step.run(`full-sync-${modelName}`, async () => {
        try {
          const count = await fullSyncModel(modelName, secondaryPrisma);
          return { success: true, count };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to full sync ${modelName}: ${errorMessage}`);
          return { success: false, error: errorMessage, count: 0 };
        }
      });

      if (result.success) {
        syncResults.modelsProcessed.push(modelName);
        syncResults.recordsSynced += result.count;
        logger.info(`Synced ${result.count} ${modelName} records`);
      } else {
        syncResults.errors.push({
          model: modelName,
          error: "error" in result ? result.error : "Unknown error",
        });
      }
    }

    return {
      success: syncResults.errors.length === 0,
      ...syncResults,
    };
  }
);

/**
 * Full sync a single model (all records)
 */
async function fullSyncModel(
  modelName: SyncableModel,
  secondaryPrisma: ReturnType<typeof getSecondaryPrisma>
): Promise<number> {
  if (!secondaryPrisma) return 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryModel = (prisma as any)[modelName];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const secondaryModel = (secondaryPrisma as any)[modelName];

  if (!primaryModel || !secondaryModel) {
    return 0;
  }

  // Get all records from primary (in batches for large tables)
  const BATCH_SIZE = 100;
  let skip = 0;
  let totalSynced = 0;

  while (true) {
    const records = await primaryModel.findMany({
      take: BATCH_SIZE,
      skip,
    });

    if (records.length === 0) break;

    // Upsert batch to secondary
    for (const record of records) {
      try {
        await secondaryModel.upsert({
          where: { id: record.id },
          update: record,
          create: record,
        });
        totalSynced++;
      } catch (error) {
        console.error(`Failed to sync ${modelName} record ${record.id}:`, error);
      }
    }

    skip += BATCH_SIZE;

    // Safety limit - don't sync more than 10,000 records per model in one run
    if (skip >= 10000) {
      console.warn(`Reached safety limit for ${modelName}, stopping at ${skip} records`);
      break;
    }
  }

  return totalSynced;
}