import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root
config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function checkTableExists(tableName) {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'opportunity_tracker'
        AND table_name = '${tableName}'
      );
    `);
    return result[0].exists;
  } catch (error) {
    return false;
  }
}

async function checkColumnExists(tableName, columnName) {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'opportunity_tracker'
        AND table_name = '${tableName}'
        AND column_name = '${columnName}'
      );
    `);
    return result[0].exists;
  } catch (error) {
    return false;
  }
}

async function checkEnumExists(enumName) {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM pg_type
        WHERE typname = '${enumName}'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'opportunity_tracker')
      );
    `);
    return result[0].exists;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔍 Checking current database state...\n');

  // Check tables
  console.log('📋 Tables:');
  const tables = ['Organization', 'OrganizationSettings', 'Invitation', 'KanbanView'];
  for (const table of tables) {
    const exists = await checkTableExists(table);
    console.log(`  ${exists ? '✅' : '❌'} ${table}`);
  }

  // Check User table columns
  console.log('\n👤 User table columns:');
  const userColumns = ['organizationId', 'role', 'managerId'];
  for (const col of userColumns) {
    const exists = await checkColumnExists('User', col);
    console.log(`  ${exists ? '✅' : '❌'} ${col}`);
  }

  // Check Opportunity table columns
  console.log('\n💼 Opportunity table columns:');
  const oppColumns = ['organizationId'];
  for (const col of oppColumns) {
    const exists = await checkColumnExists('Opportunity', col);
    console.log(`  ${exists ? '✅' : '❌'} ${col}`);
  }

  // Check Account table columns
  console.log('\n🏢 Account table columns:');
  const accountColumns = ['organizationId', 'ownerId'];
  for (const col of accountColumns) {
    const exists = await checkColumnExists('Account', col);
    console.log(`  ${exists ? '✅' : '❌'} ${col}`);
  }

  // Check KanbanColumn table columns
  console.log('\n📊 KanbanColumn table columns:');
  const kanbanColumns = ['viewId', 'userId'];
  for (const col of kanbanColumns) {
    const exists = await checkColumnExists('KanbanColumn', col);
    console.log(`  ${exists ? '✅' : '❌'} ${col}`);
  }

  // Check enums
  console.log('\n🏷️  Enums:');
  const enums = ['UserRole', 'ViewType'];
  for (const enumName of enums) {
    const exists = await checkEnumExists(enumName);
    console.log(`  ${exists ? '✅' : '❌'} ${enumName}`);
  }

  console.log('\n✅ Database state check complete!\n');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
