import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import { googleTasksClient } from '@/lib/integrations/google-tasks';

/**
 * POST /api/v1/tasks/lists/[listId]/tasks/[taskId]/complete
 * Marks a task as complete
 */
export async function POST(
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

    // Mark as complete in Google Tasks
    await googleTasksClient.completeTask(
      user.id,
      task.taskList.googleListId,
      task.googleTaskId
    );

    // Update in database
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
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

    return NextResponse.json({
      task: {
        id: updatedTask.id,
        googleTaskId: updatedTask.googleTaskId,
        title: updatedTask.title,
        notes: updatedTask.notes,
        due: updatedTask.due?.toISOString() || null,
        status: updatedTask.status,
        opportunityId: updatedTask.opportunityId,
        opportunity: updatedTask.opportunity,
        createdAt: updatedTask.createdAt.toISOString(),
        updatedAt: updatedTask.updatedAt.toISOString(),
        completedAt: updatedTask.completedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Failed to complete task:', error);

    // Provide more specific error messages based on error type
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete task';

    // Check for common OAuth errors
    if (errorMessage.includes('not connected') || errorMessage.includes('reconnect')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
