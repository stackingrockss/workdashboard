// src/lib/utils/cbc-task-creator.ts
// Creates Google Tasks for CBC (Contact Before Call) reminders

import { prisma } from "@/lib/db";
import { GoogleTasksClient } from "@/lib/integrations/google-tasks";
import { getValidAccessToken } from "@/lib/integrations/oauth-helpers";

/**
 * Data needed to create a CBC task
 */
export interface CbcTaskData {
  opportunityId: string;
  cbcDate: Date;
  lastCallDate: Date | null;
  nextCallDate: Date | null;
}

/**
 * Result of CBC task creation attempt
 */
export interface CbcTaskResult {
  created: boolean;
  taskId?: string;
  skipped?: string; // Reason for skipping
  error?: string;
}

/**
 * Create a Google Task for CBC (Contact Before Call) reminder.
 *
 * Behavior:
 * - Only creates task if user has autoCreateMeetingTasks enabled
 * - Task title: "Reach out to [Company Name]"
 * - Task due date: CBC date at 9 AM
 * - Task notes: Context about last/next meeting
 * - Deduplicates using taskSource field with opportunity ID
 * - Updates existing task if CBC date changes
 * - Requires user to have Google Tasks connected
 *
 * @param userId - User ID who owns the opportunity
 * @param data - CBC task data including opportunity and dates
 * @returns Result indicating if task was created or skipped
 */
export async function createOrUpdateCbcTask(
  userId: string,
  data: CbcTaskData
): Promise<CbcTaskResult> {
  const { opportunityId, cbcDate, lastCallDate, nextCallDate } = data;

  // 1. Check user preference
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { autoCreateMeetingTasks: true },
  });

  if (!user?.autoCreateMeetingTasks) {
    return { created: false, skipped: "User has autoCreateMeetingTasks disabled" };
  }

  // 2. Fetch opportunity and account for task title
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      name: true,
      account: {
        select: { id: true, name: true },
      },
    },
  });

  if (!opportunity?.account) {
    return { created: false, skipped: `No account found for opportunity ${opportunityId}` };
  }

  const companyName = opportunity.account.name;

  // 3. Check for existing CBC task for this opportunity
  const taskSource = `cbc:${opportunityId}`;
  const existingTask = await prisma.task.findFirst({
    where: {
      userId,
      taskSource,
    },
    select: {
      id: true,
      googleTaskId: true,
      taskListId: true,
      due: true,
      status: true,
      taskList: {
        select: { googleListId: true },
      },
    },
  });

  // 4. Get user's primary task list
  let taskList = await prisma.taskList.findFirst({
    where: {
      userId,
      title: "My Tasks",
    },
  });

  if (!taskList) {
    // Fallback: use first task list
    taskList = await prisma.taskList.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!taskList) {
    return { created: false, skipped: `User ${userId} has no Google Task lists` };
  }

  // 5. Calculate due date (CBC date at 9 AM)
  const dueDate = new Date(cbcDate);
  dueDate.setHours(9, 0, 0, 0);

  // 6. Check if user has valid Google Tasks OAuth token
  try {
    await getValidAccessToken(userId, "google");
  } catch {
    return { created: false, skipped: "User does not have valid Google OAuth token" };
  }

  // 7. Build task title and notes
  const taskTitle = `Reach out to ${companyName}`;
  const taskNotes = buildCbcTaskNotes(companyName, lastCallDate, nextCallDate);

  const googleTasksClient = new GoogleTasksClient();

  // 8. If existing task exists, check if we need to update it
  if (existingTask) {
    // Skip if task is already completed
    if (existingTask.status === "completed") {
      return { created: false, skipped: "Existing CBC task already completed" };
    }

    // Check if due date needs updating
    const existingDueDate = existingTask.due ? new Date(existingTask.due) : null;
    const dueDatesMatch =
      existingDueDate &&
      existingDueDate.toDateString() === dueDate.toDateString();

    if (dueDatesMatch) {
      return { created: false, skipped: "CBC task already exists with correct date" };
    }

    // Update existing task with new due date
    try {
      await googleTasksClient.updateTask(
        userId,
        existingTask.taskList.googleListId,
        existingTask.googleTaskId,
        {
          due: dueDate,
          notes: taskNotes, // Update notes with latest context
        }
      );

      await prisma.task.update({
        where: { id: existingTask.id },
        data: {
          due: dueDate,
          notes: taskNotes,
          updatedAt: new Date(),
        },
      });

      console.log(
        `[CBC Task] Updated CBC task for ${companyName}: new due date ${dueDate.toISOString()}`
      );

      return { created: false, taskId: existingTask.id, skipped: "Updated existing task" };
    } catch (error) {
      console.error(`[CBC Task] Failed to update Google task:`, error);
      return {
        created: false,
        error: error instanceof Error ? error.message : "Unknown error updating task",
      };
    }
  }

  // 9. Create new task via Google Tasks API
  let createdTask;

  try {
    createdTask = await googleTasksClient.createTask(userId, taskList.googleListId, {
      title: taskTitle,
      notes: taskNotes,
      due: dueDate,
    });
  } catch (error) {
    console.error(`[CBC Task] Failed to create Google task:`, error);
    return {
      created: false,
      error: error instanceof Error ? error.message : "Unknown error creating task",
    };
  }

  // 10. Store in database with UPSERT (handles race conditions)
  try {
    const dbTask = await prisma.task.upsert({
      where: {
        userId_googleTaskId: {
          userId,
          googleTaskId: createdTask.id,
        },
      },
      update: {
        title: createdTask.title,
        notes: createdTask.notes,
        due: createdTask.due,
        position: createdTask.position,
        taskSource,
        updatedAt: new Date(),
      },
      create: {
        userId,
        taskListId: taskList.id,
        googleTaskId: createdTask.id,
        title: createdTask.title,
        notes: createdTask.notes,
        due: createdTask.due,
        status: "needsAction",
        position: createdTask.position,
        opportunityId: opportunityId,
        accountId: opportunity.account.id,
        taskSource,
      },
    });

    console.log(
      `[CBC Task] Created CBC task: "${taskTitle}" due ${dueDate.toISOString()} for user ${userId}`
    );

    return { created: true, taskId: dbTask.id };
  } catch (error: unknown) {
    // Handle unique constraint violation on taskSource (race condition)
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      console.log(`[CBC Task] Task already exists (race condition handled): ${opportunityId}`);
      return { created: false, skipped: "Task already exists (race condition)" };
    }
    throw error;
  }
}

/**
 * Delete the CBC task for an opportunity (e.g., when next call is scheduled)
 */
export async function deleteCbcTask(
  userId: string,
  opportunityId: string
): Promise<{ deleted: boolean; error?: string }> {
  const taskSource = `cbc:${opportunityId}`;

  const existingTask = await prisma.task.findFirst({
    where: {
      userId,
      taskSource,
    },
    select: {
      id: true,
      googleTaskId: true,
      taskList: {
        select: { googleListId: true },
      },
    },
  });

  if (!existingTask) {
    return { deleted: false };
  }

  try {
    // Check if user has valid Google Tasks OAuth token
    await getValidAccessToken(userId, "google");

    const googleTasksClient = new GoogleTasksClient();
    await googleTasksClient.deleteTask(
      userId,
      existingTask.taskList.googleListId,
      existingTask.googleTaskId
    );

    await prisma.task.delete({
      where: { id: existingTask.id },
    });

    console.log(`[CBC Task] Deleted CBC task for opportunity ${opportunityId}`);
    return { deleted: true };
  } catch (error) {
    console.error(`[CBC Task] Failed to delete task:`, error);
    return {
      deleted: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Build task notes with context about the meeting cadence
 */
function buildCbcTaskNotes(
  companyName: string,
  lastCallDate: Date | null,
  nextCallDate: Date | null
): string {
  const lines: string[] = [
    `Time to reach out to ${companyName} with value-add content.`,
    "",
  ];

  if (lastCallDate) {
    lines.push(
      `Last meeting: ${lastCallDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}`
    );
  }

  if (nextCallDate) {
    lines.push(
      `Next meeting: ${nextCallDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}`
    );
  }

  lines.push("");
  lines.push("Ideas for value-add touchpoints:");
  lines.push("• Share relevant industry article or research");
  lines.push("• Send a quick insight related to their challenge");
  lines.push("• Forward competitive intel they'd find useful");
  lines.push("• Make an introduction to someone in your network");

  return lines.join("\n");
}

/**
 * Process CBC task creation/update for an opportunity after dates are recalculated.
 * This is the main entry point called from the recalculation flow.
 */
export async function processCbcTaskForOpportunity(
  opportunityId: string
): Promise<CbcTaskResult> {
  // 1. Fetch opportunity with owner and dates
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      ownerId: true,
      cbc: true,
      lastCallDate: true,
      nextCallDate: true,
      needsNextCallScheduled: true,
      stage: true,
    },
  });

  if (!opportunity) {
    return { created: false, error: `Opportunity ${opportunityId} not found` };
  }

  // 2. Skip closed opportunities
  if (opportunity.stage === "closedWon" || opportunity.stage === "closedLost") {
    // Delete any existing CBC task for closed opportunities
    await deleteCbcTask(opportunity.ownerId, opportunityId);
    return { created: false, skipped: "Opportunity is closed" };
  }

  // 3. If no CBC date or needs next call scheduled, delete any existing task
  if (!opportunity.cbc || opportunity.needsNextCallScheduled) {
    await deleteCbcTask(opportunity.ownerId, opportunityId);
    return {
      created: false,
      skipped: opportunity.needsNextCallScheduled
        ? "No next call scheduled"
        : "No CBC date calculated",
    };
  }

  // 4. Create or update CBC task
  return createOrUpdateCbcTask(opportunity.ownerId, {
    opportunityId,
    cbcDate: opportunity.cbc,
    lastCallDate: opportunity.lastCallDate,
    nextCallDate: opportunity.nextCallDate,
  });
}
