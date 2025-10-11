# Deployment Guide for Opportunity Tracker

## Deploying to Vercel

### Option 1: Using Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Import your repository**: `github.com/stackingrockss/workdashboard`
3. **Configure Project Settings**:
   - **Root Directory**: `opportunity-tracker`
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

4. **Set Environment Variables**:
   - Go to Settings → Environment Variables
   - Add the following variable:
     - `DATABASE_URL` = Your Neon PostgreSQL connection string
       ```
       postgresql://neondb_owner:npg_fLCbNhYl49qO@ep-polished-art-af8y9fux-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require
       ```

5. **Deploy**: Click "Deploy"

### Option 2: Using Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Navigate to the opportunity-tracker directory
cd opportunity-tracker

# Login to Vercel
vercel login

# Deploy
vercel

# For production deployment
vercel --prod
```

## Environment Variables Required

Make sure to set these in Vercel's dashboard:

- `DATABASE_URL`: Your Neon PostgreSQL connection string (already configured)

## Important Notes

1. **Root Directory**: The Next.js app is located in the `opportunity-tracker` subdirectory
2. **Database**: Using Neon PostgreSQL with schema `opportunity_tracker`
3. **Build**: The app uses Next.js 15 with App Router
4. **No additional setup needed**: Prisma Client is generated during build

## Troubleshooting

### 404 Error
If you get a 404 error after deployment:
1. Make sure "Root Directory" is set to `opportunity-tracker` in Vercel settings
2. Verify environment variables are set correctly
3. Check build logs for any errors

### Database Connection Issues
1. Verify `DATABASE_URL` is set in environment variables
2. Make sure Neon database is accessible
3. Check that the `opportunity_tracker` schema exists

### Build Failures
1. Check that all dependencies are installed
2. Verify Node.js version (should be 18+)
3. Review build logs in Vercel dashboard

## Post-Deployment

After successful deployment:
1. Visit your deployed URL
2. The seed data should already be in the database
3. Try creating, editing, and deleting opportunities
4. Test drag-and-drop functionality

## Database Schema

The app uses a separate schema called `opportunity_tracker` in your Neon database to avoid conflicts with other tables.

If you need to reset/reseed the database:
```bash
cd opportunity-tracker
npx tsx src/lib/seeds.ts
```
