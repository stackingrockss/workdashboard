#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load production .env
config({ path: resolve(__dirname, '../.env') });

console.log('Checking production database migration status...\n');
console.log('Database:', process.env.DATABASE_URL?.split('@')[1]?.split('?')[0] || 'Unknown');
console.log('');

try {
  const output = execSync('npx prisma migrate status', {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  console.log(output);
} catch (error) {
  console.error('Migration status check failed:');
  console.error(error.stdout || error.message);
  process.exit(1);
}