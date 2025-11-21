import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleTasksClient } from '@/lib/integrations/google-tasks';
import { taskListCreateSchema } from '@/lib/validations/task';

/**
 * GET /api/v1/tasks/lists
 * Lists all task lists for the authenticated user
 */
export async function GET() {
  try {
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

    // Check if user has Google Tasks connected
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

    // Fetch task lists from database (cached from background sync)
    const taskLists = await prisma.taskList.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    return NextResponse.json({
      taskLists: taskLists.map((list) => ({
        id: list.id,
        googleListId: list.googleListId,
        title: list.title,
        taskCount: list._count.tasks,
        createdAt: list.createdAt.toISOString(),
        updatedAt: list.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to list task lists:', error);

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
      { error: 'Failed to fetch task lists' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/tasks/lists
 * Creates a new task list
 */
export async function POST(req: NextRequest) {
  try {
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

    // Check if user has Google Tasks connected
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

    // Parse and validate request body
    const body = await req.json();
    const validation = taskListCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid task list data', details: validation.error },
        { status: 400 }
      );
    }

    const { title } = validation.data;

    // Create task list in Google Tasks
    const createdList = await googleTasksClient.createTaskList(user.id, title);

    // Store in database
    const taskList = await prisma.taskList.create({
      data: {
        userId: user.id,
        googleListId: createdList.id,
        title: createdList.title,
      },
    });

    return NextResponse.json(
      {
        taskList: {
          id: taskList.id,
          googleListId: taskList.googleListId,
          title: taskList.title,
          createdAt: taskList.createdAt.toISOString(),
          updatedAt: taskList.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create task list:', error);

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
      { error: 'Failed to create task list' },
      { status: 500 }
    );
  }
}
