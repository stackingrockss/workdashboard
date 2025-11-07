import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function executeIfNotExists(description, checkFn, sqlStatements) {
  try {
    const exists = await checkFn();
    if (exists) {
      console.log(`  ⏭️  ${description} - already exists, skipping`);
      return true;
    }

    console.log(`  🔄 ${description}...`);
    for (const sql of Array.isArray(sqlStatements) ? sqlStatements : [sqlStatements]) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log(`  ✅ ${description} - done`);
    return true;
  } catch (error) {
    console.error(`  ❌ ${description} - failed:`, error.message);
    throw error;
  }
}

async function columnExists(table, column) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'opportunity_tracker'
      AND table_name = '${table}'
      AND column_name = '${column}'
    );
  `);
  return result[0].exists;
}

async function main() {
  console.log('🚀 Completing organization structure migration...\n');

  try {
    // Step 1: Add organizationId to Account (nullable first)
    await executeIfNotExists(
      'Add organizationId to Account table',
      () => columnExists('Account', 'organizationId'),
      'ALTER TABLE "opportunity_tracker"."Account" ADD COLUMN "organizationId" TEXT;'
    );

    // Step 2: Populate Account.organizationId from opportunities
    console.log('  🔄 Populating Account.organizationId from opportunities...');
    await prisma.$executeRawUnsafe(`
      UPDATE "opportunity_tracker"."Account"
      SET "organizationId" = (
        SELECT "User"."organizationId"
        FROM "opportunity_tracker"."Opportunity"
        JOIN "opportunity_tracker"."User" ON "User".id = "Opportunity"."ownerId"
        WHERE "Opportunity"."accountId" = "Account".id
        LIMIT 1
      )
      WHERE "organizationId" IS NULL;
    `);

    // Step 3: For accounts with no opportunities, assign to first organization
    await prisma.$executeRawUnsafe(`
      UPDATE "opportunity_tracker"."Account"
      SET "organizationId" = (SELECT id FROM "opportunity_tracker"."Organization" LIMIT 1)
      WHERE "organizationId" IS NULL;
    `);

    // Step 4: Make Account.organizationId NOT NULL
    console.log('  🔄 Making Account.organizationId NOT NULL...');
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "opportunity_tracker"."Account" ALTER COLUMN "organizationId" SET NOT NULL;'
    );

    // Step 5: Drop old unique constraint on Account.name
    console.log('  🔄 Dropping old Account.name unique constraint...');
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "opportunity_tracker"."Account" DROP CONSTRAINT IF EXISTS "Account_name_key";'
      );
    } catch (e) {
      console.log('    (Constraint may not exist, continuing...)');
    }

    // Step 6: Add organizationId to Opportunity (nullable first)
    await executeIfNotExists(
      'Add organizationId to Opportunity table',
      () => columnExists('Opportunity', 'organizationId'),
      'ALTER TABLE "opportunity_tracker"."Opportunity" ADD COLUMN "organizationId" TEXT;'
    );

    // Step 7: Populate Opportunity.organizationId from owner
    console.log('  🔄 Populating Opportunity.organizationId from owners...');
    await prisma.$executeRawUnsafe(`
      UPDATE "opportunity_tracker"."Opportunity"
      SET "organizationId" = (
        SELECT "organizationId"
        FROM "opportunity_tracker"."User"
        WHERE "User".id = "Opportunity"."ownerId"
      )
      WHERE "organizationId" IS NULL;
    `);

    // Step 8: Make Opportunity.organizationId NOT NULL
    console.log('  🔄 Making Opportunity.organizationId NOT NULL...');
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "opportunity_tracker"."Opportunity" ALTER COLUMN "organizationId" SET NOT NULL;'
    );

    // Step 9: Handle KanbanColumn migration
    // Check if userId column still exists in KanbanColumn
    const hasUserId = await columnExists('KanbanColumn', 'userId');

    if (hasUserId) {
      // First check if there are user-specific columns
      const userColumnsExist = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT 1 FROM "opportunity_tracker"."KanbanColumn" WHERE "userId" IS NOT NULL LIMIT 1
        );
      `);

      if (userColumnsExist[0].exists) {
        console.log('  🔄 Creating KanbanViews for existing user columns...');

        // Create views for each user
        await prisma.$executeRawUnsafe(`
          INSERT INTO "opportunity_tracker"."KanbanView" (id, name, "viewType", "isActive", "isDefault", "userId", "createdAt", "updatedAt")
          SELECT
            'view-' || "userId",
            'My Custom View',
            'custom'::"opportunity_tracker"."ViewType",
            true,
            true,
            "userId",
            NOW(),
            NOW()
          FROM "opportunity_tracker"."KanbanColumn"
          WHERE "userId" IS NOT NULL
          GROUP BY "userId"
          ON CONFLICT (id) DO NOTHING;
        `);
      }

      // Step 10: Add viewId to KanbanColumn
      await executeIfNotExists(
        'Add viewId to KanbanColumn table',
        () => columnExists('KanbanColumn', 'viewId'),
        'ALTER TABLE "opportunity_tracker"."KanbanColumn" ADD COLUMN "viewId" TEXT;'
      );

      // Step 11: Populate viewId from userId
      if (userColumnsExist[0].exists) {
        console.log('  🔄 Assigning columns to views...');
        await prisma.$executeRawUnsafe(`
          UPDATE "opportunity_tracker"."KanbanColumn"
          SET "viewId" = 'view-' || "userId"
          WHERE "userId" IS NOT NULL AND "viewId" IS NULL;
        `);
      }

      // Step 12: Delete orphaned columns
      console.log('  🔄 Removing orphaned kanban columns...');
      await prisma.$executeRawUnsafe(`
        DELETE FROM "opportunity_tracker"."KanbanColumn"
        WHERE "viewId" IS NULL;
      `);

      // Step 13: Make viewId NOT NULL
      console.log('  🔄 Making KanbanColumn.viewId NOT NULL...');
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "opportunity_tracker"."KanbanColumn" ALTER COLUMN "viewId" SET NOT NULL;'
      );

      // Step 14: Drop userId column from KanbanColumn
      console.log('  🔄 Dropping userId from KanbanColumn...');

      // First drop the unique constraint if it exists
      try {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "opportunity_tracker"."KanbanColumn" DROP CONSTRAINT IF EXISTS "KanbanColumn_userId_order_key";'
        );
      } catch (e) {
        // Constraint may not exist
      }

      // Then drop the column
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "opportunity_tracker"."KanbanColumn" DROP COLUMN "userId";'
      );
      console.log('  ✅ Dropped userId column');
    } else {
      console.log('  ⏭️  KanbanColumn.userId already removed, skipping view migration');

      // Just ensure viewId exists and is populated
      await executeIfNotExists(
        'Add viewId to KanbanColumn table',
        () => columnExists('KanbanColumn', 'viewId'),
        'ALTER TABLE "opportunity_tracker"."KanbanColumn" ADD COLUMN "viewId" TEXT;'
      );

      // Create a default view for any columns without viewId
      const columnsWithoutView = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count FROM "opportunity_tracker"."KanbanColumn"
        WHERE "viewId" IS NULL;
      `);

      if (columnsWithoutView[0].count > 0) {
        console.log('  🔄 Creating default view for orphaned columns...');

        // Create a default view
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

        // Assign orphaned columns to default view with new order numbers
        await prisma.$executeRawUnsafe(`
          WITH numbered_columns AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY "order", id) as new_order
            FROM "opportunity_tracker"."KanbanColumn"
            WHERE "viewId" IS NULL
          )
          UPDATE "opportunity_tracker"."KanbanColumn" kc
          SET "viewId" = 'view-default',
              "order" = nc.new_order - 1
          FROM numbered_columns nc
          WHERE kc.id = nc.id;
        `);
      }

      // Make viewId NOT NULL if not already
      const isNullable = await prisma.$queryRawUnsafe(`
        SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'opportunity_tracker'
        AND table_name = 'KanbanColumn'
        AND column_name = 'viewId';
      `);

      if (isNullable.length > 0 && isNullable[0].is_nullable === 'YES') {
        console.log('  🔄 Making KanbanColumn.viewId NOT NULL...');
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "opportunity_tracker"."KanbanColumn" ALTER COLUMN "viewId" SET NOT NULL;'
        );
      }
    }

    // Step 15: Add foreign key constraints
    console.log('\n  🔄 Adding foreign key constraints...');

    // Account -> Organization
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "opportunity_tracker"."Account" ADD CONSTRAINT "Account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "opportunity_tracker"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;'
      );
      console.log('  ✅ Added Account.organizationId foreign key');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('  ⏭️  Account.organizationId foreign key already exists');
      } else {
        throw e;
      }
    }

    // Opportunity -> Organization
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "opportunity_tracker"."Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "opportunity_tracker"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;'
      );
      console.log('  ✅ Added Opportunity.organizationId foreign key');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('  ⏭️  Opportunity.organizationId foreign key already exists');
      } else {
        throw e;
      }
    }

    // KanbanColumn -> KanbanView
    try {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "opportunity_tracker"."KanbanColumn" ADD CONSTRAINT "KanbanColumn_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "opportunity_tracker"."KanbanView"("id") ON DELETE CASCADE ON UPDATE CASCADE;'
      );
      console.log('  ✅ Added KanbanColumn.viewId foreign key');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('  ⏭️  KanbanColumn.viewId foreign key already exists');
      } else {
        throw e;
      }
    }

    // Step 16: Add unique constraints
    console.log('\n  🔄 Adding unique constraints...');

    try {
      await prisma.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "Account_organizationId_name_key" ON "opportunity_tracker"."Account"("organizationId", "name");'
      );
      console.log('  ✅ Added Account unique constraint (organizationId, name)');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('  ⏭️  Account unique constraint already exists');
      } else {
        throw e;
      }
    }

    try {
      await prisma.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "KanbanColumn_viewId_order_key" ON "opportunity_tracker"."KanbanColumn"("viewId", "order");'
      );
      console.log('  ✅ Added KanbanColumn unique constraint (viewId, order)');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('  ⏭️  KanbanColumn unique constraint already exists');
      } else {
        throw e;
      }
    }

    console.log('\n🎉 Migration completed successfully!\n');

    // Final verification
    console.log('🔍 Verifying final state...\n');
    const checks = [
      { table: 'Account', column: 'organizationId' },
      { table: 'Opportunity', column: 'organizationId' },
      { table: 'KanbanColumn', column: 'viewId' }
    ];

    for (const check of checks) {
      const exists = await columnExists(check.table, check.column);
      console.log(`  ${exists ? '✅' : '❌'} ${check.table}.${check.column}`);
    }

    console.log('\n✅ All done! You can now run: npx prisma generate\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
