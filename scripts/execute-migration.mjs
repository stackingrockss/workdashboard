import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting migration execution...\n');

  // Read the migration SQL file
  const migrationPath = join(__dirname, '../prisma/migrations/20251106154711_add_organization_structure/migration.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  // Parse SQL statements properly (handling multi-line statements)
  const lines = migrationSQL.split('\n');
  const statements = [];
  let currentStatement = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('--')) {
      continue;
    }

    currentStatement += line + '\n';

    // Check if line ends with semicolon (end of statement)
    if (trimmedLine.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

  let executed = 0;
  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
      executed++;
      if (executed % 5 === 0 || executed === statements.length) {
        console.log(`✅ Executed ${executed}/${statements.length} statements`);
      }
    } catch (error) {
      console.error(`\n❌ Error executing statement #${executed + 1}:`);
      console.error(statement.substring(0, 200) + '...\n');
      console.error(error.message || error);
      throw error;
    }
  }

  console.log(`\n✅ Successfully executed all ${executed} statements!`);
  console.log('🎉 Migration complete!\n');
}

main()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
