require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');

console.log('Running db push with DATABASE_URL from .env.local...');
try {
  execSync('npx prisma db push', {
    stdio: 'inherit',
    env: { ...process.env }
  });
} catch (error) {
  process.exit(1);
}
