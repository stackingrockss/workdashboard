import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleTasksClient } from '@/lib/integrations/google-tasks';
import { taskCreateSchema, taskFilterSchema } from '@/lib/validations/task';

/**
 * GET /api/v1/tasks/lists/[listId]/tasks
 * Lists tasks in a task list with optional filters
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;

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

    // Verify task list ownership
    const taskList = await prisma.taskList.findUnique({
      where: {
        id: listId,
        userId: user.id,
      },
    });

    if (!taskList) {
      return NextResponse.json(
        { error: 'Task list not found' },
        { status: 404 }
      );
    }

    // Parse and validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const filterInput = {
      status: searchParams.get('status') || undefined,
      opportunityId: searchParams.get('opportunityId') || undefined,
      dueAfter: searchParams.get('dueAfter') || undefined,
      dueBefore: searchParams.get('dueBefore') || undefined,
    };

    const validation = taskFilterSchema.safeParse(filterInput);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: validation.error },
        { status: 400 }
      );
    }

    const filters = validation.data;

    // Build Prisma where clause
    const whereClause: {
      taskListId: string;
      userId: string;
      status?: 'needsAction' | 'completed';
      opportunityId?: string;
      due?: { gte?: Date; lte?: Date };
    } = {
      taskListId: listId,
      userId: user.id,
    };

    if (filters.status && filters.status !== 'all') {
      whereClause.status = filters.status;
    }

    if (filters.opportunityId) {
      whereClause.opportunityId = filters.opportunityId;
    }

    if (filters.dueAfter || filters.dueBefore) {
      whereClause.due = {};
      if (filters.dueAfter) {
        whereClause.due.gte = new Date(filters.dueAfter);
      }
      if (filters.dueBefore) {
        whereClause.due.lte = new Date(filters.dueBefore);
      }
    }

    // Fetch tasks from database
    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: { position: 'asc' },
      include: {
        opportunity: {
          select: {
            id: true,
            name: true,
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
        opportunityId: task.opportunityId,
        opportunity: task.opportunity,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        completedAt: task.completedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('Failed to list tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/tasks/lists/[listId]/tasks
 * Creates a new task in a task list
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params;

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
      include: { organization: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify task list ownership
    const taskList = await prisma.taskList.findUnique({
      where: {
        id: listId,
        userId: user.id,
      },
    });

    if (!taskList) {
      return NextResponse.json(
        { error: 'Task list not found' },
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

    // If opportunityId provided, verify ownership
    if (taskData.opportunityId) {
      const opportunity = await prisma.opportunity.findUnique({
        where: {
          id: taskData.opportunityId,
          organizationId: user.organizationId!,
        },
      });

      if (!opportunity) {
        return NextResponse.json(
          { error: 'Opportunity not found' },
          { status: 404 }
        );
      }
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

    // Store in database
    const task = await prisma.task.create({
      data: {
        userId: user.id,
        taskListId: listId,
        googleTaskId: createdTask.id,
        title: createdTask.title,
        notes: createdTask.notes,
        due: createdTask.due,
        status: createdTask.status,
        position: createdTask.position,
        opportunityId: taskData.opportunityId,
        completedAt: createdTask.completed,
      },
      include: {
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
    console.error('Failed to create task:', error);

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
