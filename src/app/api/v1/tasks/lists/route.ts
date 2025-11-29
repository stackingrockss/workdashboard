import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleTasksClient } from '@/lib/integrations/google-tasks';
import { taskListCreateSchema } from '@/lib/validations/task';
import {
  wantsPagination,
  buildPaginatedResponse,
  buildLegacyResponse,
} from '@/lib/utils/pagination';
import { paginationQuerySchema } from '@/lib/validations/pagination';
import { cachedResponse } from '@/lib/cache';
import { Prisma } from '@prisma/client';

/**
 * GET /api/v1/tasks/lists
 * Lists all task lists for the authenticated user
 */
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const whereClause = { userId: user.id };
    const usePagination = wantsPagination(searchParams);

    // Define include for relations
    const includeRelations = {
      _count: {
        select: { tasks: true },
      },
    };

    // Helper to transform task lists
    type TaskListWithCount = Prisma.TaskListGetPayload<{
      include: typeof includeRelations;
    }>;
    const transformTaskList = (list: TaskListWithCount) => ({
      id: list.id,
      googleListId: list.googleListId,
      title: list.title,
      taskCount: list._count.tasks,
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    });

    if (usePagination) {
      // PAGINATED MODE: Client requested pagination via query params
      const parsed = paginationQuerySchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit') || 50,
      });
      const page = parsed.page;
      const limit = parsed.limit ?? 50;
      const skip = (page - 1) * limit;

      // Parallel queries for performance
      const [total, taskLists] = await Promise.all([
        prisma.taskList.count({ where: whereClause }),
        prisma.taskList.findMany({
          where: whereClause,
          include: includeRelations,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      const transformedTaskLists = taskLists.map(transformTaskList);

      return cachedResponse(
        buildPaginatedResponse(transformedTaskLists, page, limit, total, 'taskLists'),
        'frequent'
      );
    } else {
      // LEGACY MODE: No pagination params, return all task lists
      const taskLists = await prisma.taskList.findMany({
        where: whereClause,
        include: includeRelations,
        orderBy: { updatedAt: 'desc' },
      });

      const transformedTaskLists = taskLists.map(transformTaskList);

      return cachedResponse(buildLegacyResponse(transformedTaskLists, 'taskLists'), 'frequent');
    }
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
