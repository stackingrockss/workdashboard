/**
 * Check Google Tasks sync status
 *
 * Run with: npx tsx scripts/check-tasks-status.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTasksStatus() {
  console.log('📋 Checking Google Tasks Sync Status\n');
  console.log('='.repeat(60));

  try {
    // Check OAuth tokens with tasks scope
    const tokensWithTasks = await prisma.oAuthToken.findMany({
      where: {
        provider: 'google',
        scopes: {
          has: 'https://www.googleapis.com/auth/tasks',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (tokensWithTasks.length === 0) {
      console.log('❌ No users with Google Tasks scope found');
      console.log('\n→ Go to /settings/integrations to connect Google Tasks');
      return;
    }

    console.log(`\n✓ Found ${tokensWithTasks.length} user(s) with Google Tasks connected:\n`);

    for (const token of tokensWithTasks) {
      console.log(`\n👤 User: ${token.user.name || token.user.email}`);
      console.log(`   User ID: ${token.user.id}`);
      console.log(`   Token expires: ${token.expiresAt.toLocaleString()}`);
      console.log(`   Token status: ${token.expiresAt > new Date() ? '✓ VALID' : '⚠️  EXPIRED (will auto-refresh)'}`);

      // Check task lists for this user
      const taskLists = await prisma.taskList.findMany({
        where: { userId: token.user.id },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      });

      if (taskLists.length === 0) {
        console.log(`   📁 Task Lists: NONE synced`);
        console.log(`   ⚠️  No task lists in database - sync may not have run yet`);
      } else {
        console.log(`   📁 Task Lists: ${taskLists.length}`);
        for (const list of taskLists) {
          console.log(`      - "${list.title}" (${list._count.tasks} tasks)`);
        }
      }

      // Check tasks for this user
      const tasks = await prisma.task.findMany({
        where: { userId: token.user.id },
        orderBy: { due: 'asc' },
      });

      const tasksWithDue = tasks.filter((t) => t.due);
      const tasksWithoutDue = tasks.filter((t) => !t.due);
      const pendingTasks = tasks.filter((t) => t.status === 'needsAction');
      const completedTasks = tasks.filter((t) => t.status === 'completed');

      console.log(`   📝 Tasks Total: ${tasks.length}`);
      console.log(`      - With due date: ${tasksWithDue.length}`);
      console.log(`      - Without due date: ${tasksWithoutDue.length}`);
      console.log(`      - Pending: ${pendingTasks.length}`);
      console.log(`      - Completed: ${completedTasks.length}`);

      if (tasks.length > 0) {
        console.log(`\n   📋 Sample Tasks (first 5):`);
        const sampleTasks = tasks.slice(0, 5);
        for (const task of sampleTasks) {
          const dueStr = task.due
            ? task.due.toLocaleDateString()
            : 'No due date';
          const statusIcon = task.status === 'completed' ? '✓' : '○';
          console.log(`      ${statusIcon} "${task.title}" (Due: ${dueStr})`);
        }
      }

      // Check last update time
      const lastUpdatedTask = await prisma.task.findFirst({
        where: { userId: token.user.id },
        orderBy: { updatedAt: 'desc' },
      });

      if (lastUpdatedTask) {
        console.log(`\n   🕐 Last sync: ${lastUpdatedTask.updatedAt.toLocaleString()}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✓ Tasks status check complete!\n');

    if (tokensWithTasks.length > 0) {
      const anyTaskLists = await prisma.taskList.count();
      if (anyTaskLists === 0) {
        console.log('🟡 Google Tasks is connected but no tasks have been synced yet');
        console.log('\nPossible reasons:');
        console.log('  1. Inngest background sync has not run yet (runs every 15 minutes)');
        console.log('  2. Inngest may not be running in development');
        console.log('  3. User has no task lists in Google Tasks');
        console.log('\nTo fix:');
        console.log('  → Start Inngest dev server: npx inngest-cli@latest dev');
        console.log('  → Or add a manual sync button to trigger immediate sync');
      }
    }
  } catch (error) {
    console.error('\n❌ Error checking tasks status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkTasksStatus().catch(console.error);
