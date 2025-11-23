import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { GoogleTasksClient } from "@/lib/integrations/google-tasks";
import { z } from "zod";

const earningsReminderSchema = z.object({
  daysBeforeEarnings: z.number().min(1).max(30).default(7),
  reminderNotes: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireAuth();

    // Parse request body
    const json = await req.json();
    const parsed = earningsReminderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { daysBeforeEarnings, reminderNotes } = parsed.data;

    // Verify account belongs to user's organization
    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId: user.organization.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (!account.nextEarningsDate) {
      return NextResponse.json(
        { error: "Account does not have an upcoming earnings date. Sync earnings first." },
        { status: 400 }
      );
    }

    // Check if reminder task already exists for this earnings date
    const existingTask = await prisma.task.findFirst({
      where: {
        accountId: account.id,
        userId: user.id,
        taskSource: "earnings_reminder",
        due: { gte: new Date() }, // Only check future tasks
      },
    });

    if (existingTask) {
      return NextResponse.json(
        { error: "Earnings reminder already exists for this account" },
        { status: 409 }
      );
    }

    // Calculate task due date (X days before earnings)
    const earningsDate = new Date(account.nextEarningsDate);
    const taskDueDate = new Date(earningsDate);
    taskDueDate.setDate(taskDueDate.getDate() - daysBeforeEarnings);

    // If due date is in the past, return error
    if (taskDueDate < new Date()) {
      return NextResponse.json(
        { error: `Earnings date is less than ${daysBeforeEarnings} days away` },
        { status: 400 }
      );
    }

    // Find user's default task list (or first available)
    const taskList = await prisma.taskList.findFirst({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "asc", // Use first/oldest list
      },
    });

    if (!taskList) {
      return NextResponse.json(
        { error: "No task list found. Please connect Google Tasks first." },
        { status: 400 }
      );
    }

    // Create task in Google Tasks
    const googleTasksClient = new GoogleTasksClient();
    const taskTitle = `Earnings Call: ${account.name}`;
    const taskNotesText = `
Upcoming earnings call for ${account.name} (${account.ticker})

Earnings Date: ${earningsDate.toLocaleDateString()}
${reminderNotes ? `\nNotes: ${reminderNotes}` : ""}

Prepare for:
- Review previous quarter performance
- Check analyst expectations
- Review industry trends
- Prepare questions for management
    `.trim();

    const googleTask = await googleTasksClient.createTask(
      user.id,
      taskList.googleListId,
      {
        title: taskTitle,
        notes: taskNotesText,
        due: taskDueDate,
      }
    );

    // Store task in database
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        taskListId: taskList.id,
        googleTaskId: googleTask.id,
        title: taskTitle,
        notes: taskNotesText,
        due: taskDueDate,
        status: "needsAction",
        position: googleTask.position,
        accountId: account.id,
        taskSource: "earnings_reminder",
      },
    });

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        due: task.due,
        accountId: task.accountId,
        taskSource: task.taskSource,
      },
      earningsDate: account.nextEarningsDate,
      daysBeforeEarnings,
    });
  } catch (error) {
    console.error("Error creating earnings reminder:", error);
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Google Tasks")) {
        return NextResponse.json(
          { error: "Failed to create task in Google Tasks. Please reconnect your Google account." },
          { status: 500 }
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to create earnings reminder" },
      { status: 500 }
    );
  }
}
