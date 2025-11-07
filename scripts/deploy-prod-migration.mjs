#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

const dbHost = dbUrl.split('@')[1]?.split('?')[0] || 'Unknown';
console.log('🚀 Deploying migration to production database...\n');
console.log('📍 Database:', dbHost);
console.log('');

try {
  const output = execSync('npx prisma migrate deploy', {
    encoding: 'utf-8',
    stdio: 'pipe',
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
  });
  console.log(output);
  console.log('✅ Migration deployed successfully!');
} catch (error) {
  console.error('❌ Migration deployment failed:');
  console.error(error.stdout || error.message);
  process.exit(1);
}
