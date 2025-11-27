import { prisma } from "@/lib/db";

async function cleanupDuplicateTasks() {
  console.log("Starting duplicate task cleanup...");

  // Find all duplicate taskSource combinations
  const duplicates = await prisma.$queryRaw<
    Array<{ userId: string; taskSource: string; count: bigint }>
  >`
    SELECT "userId", "taskSource", COUNT(*) as count
    FROM "Task"
    WHERE "taskSource" IS NOT NULL
    GROUP BY "userId", "taskSource"
    HAVING COUNT(*) > 1
  `;

  console.log(`Found ${duplicates.length} duplicate taskSource combinations`);

  let totalRemoved = 0;

  for (const dup of duplicates) {
    // Get all tasks with this userId + taskSource, ordered by creation date
    const tasks = await prisma.task.findMany({
      where: {
        userId: dup.userId,
        taskSource: dup.taskSource,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Keep the oldest, delete the rest
    const [keep, ...remove] = tasks;

    console.log(
      `User ${dup.userId}, taskSource "${dup.taskSource}": ` +
      `keeping ${keep.id} (created ${keep.createdAt}), ` +
      `removing ${remove.length} duplicates`
    );

    for (const task of remove) {
      await prisma.task.delete({ where: { id: task.id } });
      totalRemoved++;
    }
  }

  console.log(`Cleanup complete. Removed ${totalRemoved} duplicate tasks.`);

  // Verify
  const remaining = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count
    FROM (
      SELECT "userId", "taskSource", COUNT(*) as c
      FROM "Task"
      WHERE "taskSource" IS NOT NULL
      GROUP BY "userId", "taskSource"
      HAVING COUNT(*) > 1
    ) duplicates
  `;

  console.log(`Verification: ${remaining[0].count} duplicate combinations remain (should be 0)`);
}

cleanupDuplicateTasks()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
