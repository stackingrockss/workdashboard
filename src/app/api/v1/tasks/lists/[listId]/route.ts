import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleTasksClient } from '@/lib/integrations/google-tasks';
import { taskListUpdateSchema } from '@/lib/validations/task';

/**
 * GET /api/v1/tasks/lists/[listId]
 * Gets a single task list with its tasks
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

    // Find task list
    const taskList = await prisma.taskList.findUnique({
      where: {
        id: listId,
        userId: user.id, // Ensure user owns this list
      },
      include: {
        tasks: {
          orderBy: { position: 'asc' },
          include: {
            opportunity: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!taskList) {
      return NextResponse.json(
        { error: 'Task list not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      taskList: {
        id: taskList.id,
        googleListId: taskList.googleListId,
        title: taskList.title,
        createdAt: taskList.createdAt.toISOString(),
        updatedAt: taskList.updatedAt.toISOString(),
        tasks: taskList.tasks.map((task) => ({
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
      },
    });
  } catch (error) {
    console.error('Failed to get task list:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task list' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/tasks/lists/[listId]
 * Updates a task list (rename)
 */
export async function PATCH(
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

    // Find task list
    const taskList = await prisma.taskList.findUnique({
      where: {
        id: listId,
        userId: user.id, // Ensure user owns this list
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
    const validation = taskListUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid task list data', details: validation.error },
        { status: 400 }
      );
    }

    const { title } = validation.data;

    // Update in Google Tasks
    await googleTasksClient.updateTaskList(
      user.id,
      taskList.googleListId,
      title
    );

    // Update in database
    const updatedList = await prisma.taskList.update({
      where: { id: listId },
      data: { title },
    });

    return NextResponse.json({
      taskList: {
        id: updatedList.id,
        googleListId: updatedList.googleListId,
        title: updatedList.title,
        createdAt: updatedList.createdAt.toISOString(),
        updatedAt: updatedList.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to update task list:', error);
    return NextResponse.json(
      { error: 'Failed to update task list' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/tasks/lists/[listId]
 * Deletes a task list
 */
export async function DELETE(
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

    // Find task list
    const taskList = await prisma.taskList.findUnique({
      where: {
        id: listId,
        userId: user.id, // Ensure user owns this list
      },
    });

    if (!taskList) {
      return NextResponse.json(
        { error: 'Task list not found' },
        { status: 404 }
      );
    }

    // Delete from Google Tasks
    await googleTasksClient.deleteTaskList(user.id, taskList.googleListId);

    // Delete from database (will cascade delete all tasks)
    await prisma.taskList.delete({
      where: { id: listId },
    });

    return NextResponse.json({
      success: true,
      message: 'Task list deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete task list:', error);
    return NextResponse.json(
      { error: 'Failed to delete task list' },
      { status: 500 }
    );
  }
}
