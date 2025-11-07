#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read production DATABASE_URL
const envPath = resolve(__dirname, '../.env.production');
const envContent = readFileSync(envPath, 'utf-8');
const dbUrl = envContent
  .split('\n')
  .find(line => line.startsWith('DATABASE_URL='))
  ?.replace('DATABASE_URL=', '')
  ?.replace(/['"]/g, '')
  ?.trim();

if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in .env.production');
  process.exit(1);
}

// Connect to production database
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

async function checkColumns() {
  try {
    console.log('🔍 Checking production database schema...\n');

    // Check if Opportunity table has pinnedToWhiteboard column
    const result = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'opportunity_tracker'
        AND table_name = 'Opportunity'
      ORDER BY ordinal_position;
    `;

    const columnNames = result.map(r => r.column_name);
    console.log('📋 Opportunity table columns:');
    columnNames.forEach(col => console.log(`  - ${col}`));

    const hasPinned = columnNames.includes('pinnedToWhiteboard');
    console.log(`\n${hasPinned ? '✅' : '❌'} pinnedToWhiteboard column ${hasPinned ? 'EXISTS' : 'MISSING'}`);

    // Check if organizationId exists (to know if org migration ran)
    const hasOrg = columnNames.includes('organizationId');
    console.log(`${hasOrg ? '✅' : '❌'} organizationId column ${hasOrg ? 'EXISTS' : 'MISSING'}`);

    if (!hasPinned) {
      console.log('\n⚠️  Need to add pinnedToWhiteboard column to production');
    }

  } catch (error) {
    console.error('❌ Error checking columns:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
