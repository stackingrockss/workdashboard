// src/lib/inngest/functions/sync-google-tasks.ts
// Inngest background job for syncing Google Tasks to database

import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db';
import {
  googleTasksClient,
  type TaskListData,
  type TaskData,
} from '@/lib/integrations/google-tasks';
import { getValidAccessToken } from '@/lib/integrations/oauth-helpers';

/**
 * Background job that syncs tasks for all users with connected Google Tasks
 * Runs every 15 minutes via cron schedule
 * Stores tasks in Task and TaskList tables for fast database queries
 */
export const syncAllGoogleTasksJob = inngest.createFunction(
  {
    id: 'sync-all-google-tasks',
    name: 'Sync All Google Tasks',
    retries: 2, // Retry entire batch up to 2 times on infrastructure failures
  },
  { cron: '*/15 * * * *' }, // Every 15 minutes
  async ({ step }) => {
    // Step 1: Fetch all users with active Google OAuth tokens that have tasks scope
    const usersWithTasks = await step.run('fetch-users-with-tasks', async () => {
      const users = await prisma.oAuthToken.findMany({
        where: {
          provider: 'google',
          scopes: {
            has: 'https://www.googleapis.com/auth/tasks',
          },
        },
        select: {
          userId: true,
          expiresAt: true,
        },
      });

      return users.map((u) => u.userId);
    });

    if (usersWithTasks.length === 0) {
      return {
        success: true,
        message: 'No users with Google Tasks connected',
        totalUsers: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
      };
    }

    let successfulSyncs = 0;
    let failedSyncs = 0;
    const syncErrors: Array<{ userId: string; error: string }> = [];

    // Step 2: Sync each user sequentially with individual error handling
    for (const userId of usersWithTasks) {
      await step.run(`sync-user-${userId}`, async () => {
        try {
          // Validate access token (auto-refreshes if expired)
          try {
            await getValidAccessToken(userId, 'google');
          } catch {
            // Token expired or revoked, skip this user
            console.warn(
              `User ${userId}: Google Tasks not connected or token invalid`
            );
            failedSyncs++;
            syncErrors.push({
              userId,
              error: 'Token invalid or expired',
            });
            return { skipped: true, reason: 'Token invalid' };
          }

          // Fetch all task lists from Google Tasks API
          const googleTaskLists = await googleTasksClient.listTaskLists(userId);

          if (googleTaskLists.length === 0) {
            console.log(`User ${userId}: No task lists found`);
            successfulSyncs++;
            return {
              success: true,
              listsSynced: 0,
              tasksSynced: 0,
            };
          }

          // Sync task lists
          let listsSynced = 0;
          let tasksSynced = 0;

          for (const googleList of googleTaskLists) {
            try {
              // Upsert task list
              const taskList = await prisma.taskList.upsert({
                where: {
                  userId_googleListId: {
                    userId,
                    googleListId: googleList.id,
                  },
                },
                update: {
                  title: googleList.title,
                },
                create: {
                  userId,
                  googleListId: googleList.id,
                  title: googleList.title,
                },
              });

              listsSynced++;

              // Fetch tasks for this list
              const googleTasks = await googleTasksClient.listTasks(
                userId,
                googleList.id,
                {
                  showCompleted: true,
                  showHidden: false,
                  maxResults: 100,
                }
              );

              // Extract Google task IDs for this list
              const googleTaskIds = googleTasks.tasks.map((t) => t.id);

              // Upsert tasks
              for (const googleTask of googleTasks.tasks) {
                try {
                  await prisma.task.upsert({
                    where: {
                      userId_googleTaskId: {
                        userId,
                        googleTaskId: googleTask.id,
                      },
                    },
                    update: {
                      title: googleTask.title,
                      notes: googleTask.notes,
                      due: googleTask.due,
                      status: googleTask.status,
                      position: googleTask.position,
                      completedAt: googleTask.completed,
                      // Note: opportunityId is NOT updated here
                      // That's set manually via UI linking functionality
                    },
                    create: {
                      userId,
                      taskListId: taskList.id,
                      googleTaskId: googleTask.id,
                      title: googleTask.title,
                      notes: googleTask.notes,
                      due: googleTask.due,
                      status: googleTask.status,
                      position: googleTask.position,
                      completedAt: googleTask.completed,
                    },
                  });
                  tasksSynced++;
                } catch (error) {
                  console.error(
                    `Failed to upsert task ${googleTask.id} for user ${userId}:`,
                    error
                  );
                  // Continue to next task instead of failing entire sync
                }
              }

              // Delete stale tasks (tasks not in Google API response for this list)
              // Only delete tasks created more than 1 minute ago to avoid race conditions
              const oneMinuteAgo = new Date(Date.now() - 60000);
              const deleteResult = await prisma.task.deleteMany({
                where: {
                  userId,
                  taskListId: taskList.id,
                  googleTaskId: {
                    notIn: googleTaskIds,
                  },
                  createdAt: {
                    lt: oneMinuteAgo,
                  },
                },
              });

              if (deleteResult.count > 0) {
                console.log(
                  `User ${userId}: Deleted ${deleteResult.count} stale tasks from list ${googleList.title}`
                );
              }
            } catch (error) {
              console.error(
                `Failed to sync task list ${googleList.id} for user ${userId}:`,
                error
              );
              // Continue to next list instead of failing entire sync
            }
          }

          // Delete stale task lists (lists not in Google API response)
          const googleListIds = googleTaskLists.map((l) => l.id);
          const deleteListsResult = await prisma.taskList.deleteMany({
            where: {
              userId,
              googleListId: {
                notIn: googleListIds,
              },
            },
          });

          if (deleteListsResult.count > 0) {
            console.log(
              `User ${userId}: Deleted ${deleteListsResult.count} stale task lists`
            );
          }

          console.log(
            `User ${userId}: Synced ${listsSynced} lists and ${tasksSynced} tasks`
          );

          successfulSyncs++;
          return {
            success: true,
            listsSynced,
            tasksSynced,
          };
        } catch (error) {
          console.error(`Failed to sync Google Tasks for user ${userId}:`, error);
          failedSyncs++;
          syncErrors.push({
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });
    }

    // Return summary
    return {
      success: true,
      totalUsers: usersWithTasks.length,
      successfulSyncs,
      failedSyncs,
      syncErrors: syncErrors.length > 0 ? syncErrors : undefined,
    };
  }
);
