#!/usr/bin/env node
/**
 * Deploy migrations to production database
 * This script loads the production DATABASE_URL from .env and deploys pending migrations
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read and parse .env.production file manually to avoid .env.local interference
const envPath = resolve(__dirname, '../.env.production');
const envContent = readFileSync(envPath, 'utf-8');
const dbUrl = envContent
  .split('\n')
  .find(line => line.startsWith('DATABASE_URL='))
  ?.replace('DATABASE_URL=', '')
  ?.replace(/['"]/g, '')
  ?.trim();

if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

// Extract database host for display (hide credentials)
const dbHost = dbUrl.split('@')[1]?.split('?')[0] || 'Unknown';
console.log('🚀 Deploying migrations to production...');
console.log('📍 Database:', dbHost);
console.log('');

// Confirm with user
console.log('⚠️  This will apply all pending migrations to the production database.');
console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...');
console.log('');

// Wait 3 seconds before proceeding
await new Promise(resolve => setTimeout(resolve, 3000));

try {
  // Run migrate deploy with production DATABASE_URL
  const output = execSync('npx prisma migrate deploy', {
    encoding: 'utf-8',
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
  });

  console.log('');
  console.log('✅ Migrations deployed successfully!');
} catch (error) {
  console.error('');
  console.error('❌ Migration deployment failed');
  console.error(error.message);
  process.exit(1);
}
