import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runMigration() {
  const migrationPath = path.join(
    __dirname,
    '../prisma/migrations/20251106154711_add_organization_structure/migration.sql'
  );

  console.log('Reading migration file...');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Executing migration...');
  try {
    // Execute the migration in a transaction
    await prisma.$executeRawUnsafe(migrationSQL);
    console.log('✅ Migration executed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .then(() => {
    console.log('Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });
