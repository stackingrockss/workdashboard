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
  console.log('🔄 Removing migration record from _prisma_migrations table...\n');

  try {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "_prisma_migrations"
      WHERE "migration_name" = '20251106154711_add_organization_structure';
    `);

    console.log('✅ Migration record removed successfully!\n');
    console.log('You can now run: node scripts/execute-migration.mjs\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
