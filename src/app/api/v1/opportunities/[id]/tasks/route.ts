import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleTasksClient } from '@/lib/integrations/google-tasks';
import { taskCreateSchema } from '@/lib/validations/task';

/**
 * GET /api/v1/opportunities/[id]/tasks
 * Gets all tasks linked to an opportunity
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params;

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify opportunity exists and user has access
    const opportunity = await prisma.opportunity.findUnique({
      where: {
        id: opportunityId,
        organizationId: user.organizationId!,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    // Fetch all tasks linked to this opportunity
    const tasks = await prisma.task.findMany({
      where: {
        opportunityId,
        userId: user.id, // Only show user's own tasks
      },
      orderBy: [{ status: 'asc' }, { due: 'asc' }],
      include: {
        taskList: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      tasks: tasks.map((task) => ({
        id: task.id,
        googleTaskId: task.googleTaskId,
        title: task.title,
        notes: task.notes,
        due: task.due?.toISOString() || null,
        status: task.status,
        taskListId: task.taskListId,
        taskList: task.taskList,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        completedAt: task.completedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('Failed to list opportunity tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunity tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/opportunities/[id]/tasks
 * Creates a new task linked to an opportunity
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: opportunityId } = await params;

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify opportunity exists and user has access
    const opportunity = await prisma.opportunity.findUnique({
      where: {
        id: opportunityId,
        organizationId: user.organizationId!,
      },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: 'Opportunity not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = taskCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid task data', details: validation.error },
        { status: 400 }
      );
    }

    const taskData = validation.data;

    // Get user's default task list (or first available)
    let taskList = await prisma.taskList.findFirst({
      where: {
        userId: user.id,
        title: 'My Tasks', // Default task list name
      },
    });

    // If no default list, get first available list
    if (!taskList) {
      taskList = await prisma.taskList.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });
    }

    // If still no list, return error (user needs to create a list first)
    if (!taskList) {
      return NextResponse.json(
        {
          error: 'No task list found',
          message:
            'Please create a task list first before creating tasks.',
        },
        { status: 400 }
      );
    }

    // Create task in Google Tasks
    const createdTask = await googleTasksClient.createTask(
      user.id,
      taskList.googleListId,
      {
        title: taskData.title,
        notes: taskData.notes,
        due: taskData.due ? new Date(taskData.due) : undefined,
      }
    );

    // Store in database with opportunityId link
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        taskListId: taskList.id,
        googleTaskId: createdTask.id,
        title: createdTask.title,
        notes: createdTask.notes,
        due: createdTask.due,
        status: createdTask.status,
        position: createdTask.position,
        opportunityId, // Link to opportunity
        completedAt: createdTask.completed,
      },
      include: {
        taskList: {
          select: {
            id: true,
            title: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        task: {
          id: task.id,
          googleTaskId: task.googleTaskId,
          title: task.title,
          notes: task.notes,
          due: task.due?.toISOString() || null,
          status: task.status,
          taskListId: task.taskListId,
          taskList: task.taskList,
          opportunityId: task.opportunityId,
          opportunity: task.opportunity,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          completedAt: task.completedAt?.toISOString() || null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create opportunity task:', error);

    if (
      error instanceof Error &&
      error.message?.includes('not connected')
    ) {
      return NextResponse.json(
        {
          error: 'Google Tasks not connected',
          message: 'Please connect your Google Tasks in Settings.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
