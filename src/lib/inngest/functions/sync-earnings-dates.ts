// src/lib/inngest/functions/sync-earnings-dates.ts
// Inngest background job for syncing earnings dates and creating reminder tasks

import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/db";
import {
  getNextEarningsDate as getFinnhubEarningsDate,
  isFinnhubConfigured,
} from "@/lib/integrations/finnhub";
import { estimateNextEarningsDate as getSecEdgarEstimate } from "@/lib/integrations/sec-edgar";
import { GoogleTasksClient } from "@/lib/integrations/google-tasks";
import { add } from "date-fns";

/**
 * Background job that syncs earnings dates for all accounts with tickers
 * Creates reminder tasks 7-14 days before earnings
 * Runs daily at 9 AM
 */
export const syncEarningsDatesJob = inngest.createFunction(
  {
    id: "sync-earnings-dates",
    name: "Sync Earnings Dates and Create Reminders",
    retries: 2,
  },
  { cron: "0 9 * * *" }, // Daily at 9 AM
  async ({ step }) => {
    // Step 1: Fetch all accounts with tickers
    const accountsWithTickers = await step.run("fetch-accounts-with-tickers", async () => {
      const accounts = await prisma.account.findMany({
        where: {
          ticker: { not: null },
        },
        select: {
          id: true,
          ticker: true,
          name: true,
          organizationId: true,
          lastEarningsSync: true,
        },
      });

      return accounts.filter((acc) => acc.ticker !== null);
    });

    if (accountsWithTickers.length === 0) {
      return {
        success: true,
        message: "No accounts with tickers found",
        totalAccounts: 0,
        earningsSynced: 0,
        remindersCreated: 0,
        errors: 0,
      };
    }

    let earningsSynced = 0;
    let earningsFailed = 0;
    const syncErrors: Array<{ accountId: string; error: string }> = [];

    // Step 2: For each account, fetch and update earnings calendar
    for (const account of accountsWithTickers) {
      await step.run(`sync-earnings-${account.id}`, async () => {
        try {
          let earningsResult: {
            date: Date;
            isEstimate: boolean;
            source: string;
          } | null = null;

          // Try Finnhub first (more accurate, has actual earnings calendar)
          if (isFinnhubConfigured()) {
            try {
              earningsResult = await getFinnhubEarningsDate(account.ticker!);
            } catch (error) {
              console.warn(`Finnhub failed for ${account.name}:`, error);
            }
          }

          // Fall back to SEC EDGAR estimate
          if (!earningsResult) {
            try {
              earningsResult = await getSecEdgarEstimate(account.ticker!);
            } catch (error) {
              console.warn(`SEC EDGAR estimate failed for ${account.name}:`, error);
            }
          }

          // Update account with earnings date
          if (earningsResult) {
            await prisma.account.update({
              where: { id: account.id },
              data: {
                nextEarningsDate: earningsResult.date,
                earningsDateSource: earningsResult.isEstimate
                  ? `${earningsResult.source}-estimate`
                  : earningsResult.source,
                lastEarningsSync: new Date(),
              },
            });
            earningsSynced++;
            return {
              success: true,
              earningsFound: true,
              nextEarningsDate: earningsResult.date.toISOString(),
              source: earningsResult.source,
              isEstimate: earningsResult.isEstimate,
            };
          } else {
            // No earnings data found, clear the date
            await prisma.account.update({
              where: { id: account.id },
              data: {
                nextEarningsDate: null,
                lastEarningsSync: new Date(),
              },
            });
            earningsSynced++;
            return { success: true, earningsFound: false };
          }
        } catch (error) {
          console.error(`Failed to sync earnings for account ${account.name}:`, error);
          earningsFailed++;
          syncErrors.push({
            accountId: account.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return { success: false, error: String(error) };
        }
      });
    }

    // Step 3: Find accounts with earnings 7-14 days away
    const upcomingAccounts = await step.run("find-upcoming-earnings", async () => {
      const sevenDaysFromNow = add(new Date(), { days: 7 });
      const fourteenDaysFromNow = add(new Date(), { days: 14 });

      return await prisma.account.findMany({
        where: {
          nextEarningsDate: {
            gte: sevenDaysFromNow,
            lte: fourteenDaysFromNow,
          },
        },
        include: {
          organization: {
            include: {
              users: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    let remindersCreated = 0;
    let remindersFailed = 0;

    // Step 4: Create reminder tasks for upcoming earnings
    for (const account of upcomingAccounts) {
      await step.run(`create-reminders-${account.id}`, async () => {
        if (!account.nextEarningsDate) return { skipped: true };

        const earningsDate = new Date(account.nextEarningsDate);
        const taskDueDate = new Date(earningsDate);
        taskDueDate.setDate(taskDueDate.getDate() - 2); // Reminder 2 days before

        // Create task for each user in the organization
        for (const user of account.organization.users) {
          try {
            // Build unique taskSource with account ID and date
            const earningsDateStr = earningsDate.toISOString().split('T')[0]; // YYYY-MM-DD
            const taskSource = `earnings-reminder:${account.id}:${earningsDateStr}`;

            // Early duplicate check (BEFORE API call)
            const existingTask = await prisma.task.findFirst({
              where: { userId: user.id, taskSource },
            });

            if (existingTask) {
              console.log(`Reminder already exists for ${account.name} - ${user.name || user.id}`);
              continue;
            }

            // Find user's default task list
            const taskList = await prisma.taskList.findFirst({
              where: { userId: user.id },
              orderBy: { createdAt: "asc" },
            });

            if (!taskList) {
              console.log(`User ${user.id} has no task list`);
              continue;
            }

            // Prepare task content
            const taskTitle = `Earnings Call: ${account.name}`;
            const taskNotes = `
Upcoming earnings call for ${account.name} (${account.ticker})

Earnings Date: ${earningsDate.toLocaleDateString()}

Prepare for:
- Review previous quarter performance
- Check analyst expectations
- Review industry trends
- Prepare questions for management
            `.trim();

            // Create task via Google Tasks API
            const googleTasksClient = new GoogleTasksClient();
            let googleTask;

            try {
              googleTask = await googleTasksClient.createTask(user.id, taskList.googleListId, {
                title: taskTitle,
                notes: taskNotes,
                due: taskDueDate,
              });
            } catch (error) {
              console.error(`Failed to create Google task for user ${user.id}:`, error);
              remindersFailed++;
              continue;
            }

            // Store task in database with UPSERT
            try {
              await prisma.task.upsert({
                where: {
                  userId_googleTaskId: {
                    userId: user.id,
                    googleTaskId: googleTask.id,
                  },
                },
                update: {
                  title: taskTitle,
                  notes: taskNotes,
                  due: taskDueDate,
                  position: googleTask.position,
                  taskSource,
                  updatedAt: new Date(),
                },
                create: {
                  userId: user.id,
                  taskListId: taskList.id,
                  googleTaskId: googleTask.id,
                  title: taskTitle,
                  notes: taskNotes,
                  due: taskDueDate,
                  status: "needsAction",
                  position: googleTask.position,
                  accountId: account.id,
                  taskSource, // REQUIRED for uniqueness (format: earnings-reminder:{accountId}:{date})
                },
              });

              remindersCreated++;
              console.log(`Created earnings reminder for ${account.name} - ${user.name || user.id}`);
            } catch (error: unknown) {
              // Handle unique constraint violation
              const prismaError = error as { code?: string; meta?: { target?: string[] } };
              if (prismaError.code === 'P2002' && prismaError.meta?.target?.includes('taskSource')) {
                console.log(`Reminder already exists (race condition): ${account.name} - ${user.id}`);
                continue;
              }
              console.error(`Failed to store task for user ${user.id}:`, error);
              remindersFailed++;
            }
          } catch (error) {
            console.error(`Failed to create reminder for user ${user.id}:`, error);
            remindersFailed++;
          }
        }

        return {
          success: true,
          remindersCreated: account.organization.users.length,
        };
      });
    }

    // Return summary
    return {
      success: true,
      totalAccounts: accountsWithTickers.length,
      earningsSynced,
      earningsFailed,
      upcomingEarningsCount: upcomingAccounts.length,
      remindersCreated,
      remindersFailed,
      errors: syncErrors,
    };
  }
);
