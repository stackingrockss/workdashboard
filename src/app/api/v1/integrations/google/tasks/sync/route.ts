// src/app/api/v1/integrations/google/tasks/sync/route.ts
// Manual trigger API for syncing Google Tasks immediately

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { googleTasksClient } from '@/lib/integrations/google-tasks';
import { getValidAccessToken } from '@/lib/integrations/oauth-helpers';
import { requireAuth } from '@/lib/auth';

/**
 * POST /api/v1/integrations/google/tasks/sync
 *
 * Manually triggers a Google Tasks sync for the authenticated user.
 * Fetches all task lists and tasks from Google Tasks API and stores them in the database.
 *
 * @returns Sync status and statistics
 */
export async function POST() {
  try {
    // 1. Authenticate user
    const user = await requireAuth();

    // 2. Check if user has Google Tasks connected
    const oauthToken = await prisma.oAuthToken.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: 'google',
        },
      },
    });

    if (!oauthToken) {
      return NextResponse.json(
        {
          error: 'Google Tasks not connected',
          message: 'Please connect Google Tasks in Settings.',
        },
        { status: 400 }
      );
    }

    // Check if user has tasks scope
    const hasTasksAccess = oauthToken.scopes.includes(
      'https://www.googleapis.com/auth/tasks'
    );

    if (!hasTasksAccess) {
      return NextResponse.json(
        {
          error: 'Google Tasks access not granted',
          message:
            'Please reconnect your Google account to grant Tasks permissions.',
        },
        { status: 403 }
      );
    }

    // 3. Validate and refresh access token if needed
    try {
      await getValidAccessToken(user.id, 'google');
    } catch {
      return NextResponse.json(
        {
          error: 'Failed to validate access token. Please reconnect your Google account.',
        },
        { status: 401 }
      );
    }

    console.log(`[Tasks Sync] Starting manual sync for user ${user.id}`);

    // 4. Fetch all task lists from Google Tasks API
    const googleTaskLists = await googleTasksClient.listTaskLists(user.id);

    if (googleTaskLists.length === 0) {
      console.log(`[Tasks Sync] User ${user.id}: No task lists found`);
      return NextResponse.json({
        success: true,
        message: 'No task lists found in Google Tasks',
        stats: {
          listsSynced: 0,
          tasksSynced: 0,
        },
      });
    }

    // 5. Sync task lists and tasks
    let listsSynced = 0;
    let tasksSynced = 0;
    let tasksDeleted = 0;
    const errors: string[] = [];

    for (const googleList of googleTaskLists) {
      try {
        // Upsert task list
        const taskList = await prisma.taskList.upsert({
          where: {
            userId_googleListId: {
              userId: user.id,
              googleListId: googleList.id,
            },
          },
          update: {
            title: googleList.title,
          },
          create: {
            userId: user.id,
            googleListId: googleList.id,
            title: googleList.title,
          },
        });

        listsSynced++;

        // Fetch tasks for this list
        const googleTasks = await googleTasksClient.listTasks(
          user.id,
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
                  userId: user.id,
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
              },
              create: {
                userId: user.id,
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
              `[Tasks Sync] Failed to upsert task ${googleTask.id}:`,
              error
            );
            errors.push(`Failed to sync task: ${googleTask.title}`);
          }
        }

        // Delete stale tasks (tasks not in Google API response for this list)
        const deleteResult = await prisma.task.deleteMany({
          where: {
            userId: user.id,
            taskListId: taskList.id,
            googleTaskId: {
              notIn: googleTaskIds,
            },
          },
        });

        tasksDeleted += deleteResult.count;
      } catch (error) {
        console.error(
          `[Tasks Sync] Failed to sync task list ${googleList.id}:`,
          error
        );
        errors.push(`Failed to sync list: ${googleList.title}`);
      }
    }

    // Delete stale task lists (lists not in Google API response)
    const googleListIds = googleTaskLists.map((l) => l.id);
    const deleteListsResult = await prisma.taskList.deleteMany({
      where: {
        userId: user.id,
        googleListId: {
          notIn: googleListIds,
        },
      },
    });

    console.log(
      `[Tasks Sync] Completed for user ${user.id}: ${listsSynced} lists, ${tasksSynced} tasks synced, ${tasksDeleted} tasks deleted, ${deleteListsResult.count} lists deleted`
    );

    return NextResponse.json({
      success: true,
      message: 'Successfully synced Google Tasks',
      stats: {
        listsSynced,
        tasksSynced,
        tasksDeleted,
        listsDeleted: deleteListsResult.count,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('[Tasks Sync] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync Google Tasks',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
