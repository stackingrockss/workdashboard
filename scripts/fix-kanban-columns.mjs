import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing Kanban columns...\n');

  // Check current state
  const columns = await prisma.$queryRawUnsafe(`
    SELECT id, title, "order", "viewId"
    FROM "opportunity_tracker"."KanbanColumn"
    ORDER BY "order";
  `);

  console.log('Current columns:');
  console.table(columns);

  // Drop the unique constraint if it exists
  console.log('\n🔄 Dropping unique constraint temporarily...');
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "opportunity_tracker"."KanbanColumn"
      DROP CONSTRAINT IF EXISTS "KanbanColumn_viewId_order_key";
    `);
    console.log('✅ Constraint dropped');
  } catch (e) {
    console.log('⏭️  Constraint does not exist');
  }

  // Create a default view if needed
  console.log('\n🔄 Ensuring default view exists...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO "opportunity_tracker"."KanbanView" (id, name, "viewType", "isActive", "isDefault", "organizationId", "createdAt", "updatedAt")
    SELECT
      'view-default',
      'Default View',
      'custom'::"opportunity_tracker"."ViewType",
      true,
      true,
      (SELECT id FROM "opportunity_tracker"."Organization" LIMIT 1),
      NOW(),
      NOW()
    ON CONFLICT (id) DO NOTHING;
  `);

  // Reassign all columns to default view with sequential order numbers
  console.log('\n🔄 Reassigning all columns to default view with sequential orders...');
  await prisma.$executeRawUnsafe(`
    WITH numbered_columns AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY "order", id) - 1 as new_order
      FROM "opportunity_tracker"."KanbanColumn"
    )
    UPDATE "opportunity_tracker"."KanbanColumn" kc
    SET "viewId" = 'view-default',
        "order" = nc.new_order
    FROM numbered_columns nc
    WHERE kc.id = nc.id;
  `);

  // Verify no duplicates
  const afterUpdate = await prisma.$queryRawUnsafe(`
    SELECT id, title, "order", "viewId"
    FROM "opportunity_tracker"."KanbanColumn"
    ORDER BY "order";
  `);

  console.log('\nColumns after fix:');
  console.table(afterUpdate);

  // Check for duplicates
  const duplicates = await prisma.$queryRawUnsafe(`
    SELECT "viewId", "order", COUNT(*) as count
    FROM "opportunity_tracker"."KanbanColumn"
    GROUP BY "viewId", "order"
    HAVING COUNT(*) > 1;
  `);

  if (duplicates.length > 0) {
    console.log('\n❌ Still have duplicates:');
    console.table(duplicates);
  } else {
    console.log('\n✅ No duplicates found!');
  }

  // Recreate the unique constraint
  console.log('\n🔄 Recreating unique constraint...');
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX "KanbanColumn_viewId_order_key"
    ON "opportunity_tracker"."KanbanColumn"("viewId", "order");
  `);
  console.log('✅ Constraint recreated');

  console.log('\n🎉 Kanban columns fixed!\n');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
