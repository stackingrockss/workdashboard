import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleTasksClient } from '@/lib/integrations/google-tasks';
import { taskUpdateSchema } from '@/lib/validations/task';

/**
 * GET /api/v1/tasks/lists/[listId]/tasks/[taskId]
 * Gets a single task
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ listId: string; taskId: string }> }
) {
  try {
    const { listId, taskId } = await params;

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

    // Find task
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
        taskListId: listId,
        userId: user.id, // Ensure user owns this task
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

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('Failed to get task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/tasks/lists/[listId]/tasks/[taskId]
 * Updates a task
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ listId: string; taskId: string }> }
) {
  try {
    const { listId, taskId } = await params;

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

    // Find task and verify ownership
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
        taskListId: listId,
        userId: user.id,
      },
      include: {
        taskList: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = taskUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid task data', details: validation.error },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // If opportunityId is being updated, verify ownership
    if (updates.opportunityId !== undefined && updates.opportunityId !== null) {
      const opportunity = await prisma.opportunity.findUnique({
        where: {
          id: updates.opportunityId,
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

    // Update in Google Tasks
    const updatedTask = await googleTasksClient.updateTask(
      user.id,
      task.taskList.googleListId,
      task.googleTaskId,
      {
        title: updates.title,
        notes: updates.notes ?? undefined,
        due: updates.due ? new Date(updates.due) : null,
        status: updates.status,
      }
    );

    // Update in database
    const dbUpdateData: {
      title?: string;
      notes?: string | null;
      due?: Date | null;
      status?: 'needsAction' | 'completed';
      opportunityId?: string | null;
      completedAt?: Date | null;
    } = {};

    if (updates.title !== undefined) {
      dbUpdateData.title = updates.title;
    }
    if (updates.notes !== undefined) {
      dbUpdateData.notes = updates.notes;
    }
    if (updates.due !== undefined) {
      dbUpdateData.due = updates.due ? new Date(updates.due) : null;
    }
    if (updates.status !== undefined) {
      dbUpdateData.status = updates.status;
      dbUpdateData.completedAt =
        updates.status === 'completed' ? new Date() : null;
    }
    if (updates.opportunityId !== undefined) {
      dbUpdateData.opportunityId = updates.opportunityId;
    }

    const updatedDbTask = await prisma.task.update({
      where: { id: taskId },
      data: dbUpdateData,
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
      task: {
        id: updatedDbTask.id,
        googleTaskId: updatedDbTask.googleTaskId,
        title: updatedDbTask.title,
        notes: updatedDbTask.notes,
        due: updatedDbTask.due?.toISOString() || null,
        status: updatedDbTask.status,
        opportunityId: updatedDbTask.opportunityId,
        opportunity: updatedDbTask.opportunity,
        createdAt: updatedDbTask.createdAt.toISOString(),
        updatedAt: updatedDbTask.updatedAt.toISOString(),
        completedAt: updatedDbTask.completedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/tasks/lists/[listId]/tasks/[taskId]
 * Deletes a task
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ listId: string; taskId: string }> }
) {
  try {
    const { listId, taskId } = await params;

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

    // Find task and verify ownership
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
        taskListId: listId,
        userId: user.id,
      },
      include: {
        taskList: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Delete from Google Tasks
    await googleTasksClient.deleteTask(
      user.id,
      task.taskList.googleListId,
      task.googleTaskId
    );

    // Delete from database
    await prisma.task.delete({
      where: { id: taskId },
    });

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
