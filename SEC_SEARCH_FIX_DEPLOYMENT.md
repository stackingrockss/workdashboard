# SEC Company Search Fix - Deployment Guide

## Problem Fixed

The `/api/v1/sec/search-companies` endpoint was returning 500 errors due to:
1. Unreliable in-memory caching in serverless environment
2. Insufficient error handling and retry logic
3. Potential SEC API rate limiting and timeout issues

## Solution Implemented

### 1. **Database-Backed Caching**
- Added `SecCompanyCache` table to store ~13,000 SEC companies
- Searches now query the database instead of fetching from SEC API every time
- 24-hour cache TTL with automatic background refresh

### 2. **Retry Logic with Exponential Backoff**
- All SEC API calls now retry up to 3 times on failure
- Exponential backoff prevents overwhelming the SEC API
- Better error logging and detailed error messages

### 3. **Background Refresh Job**
- Inngest cron job refreshes cache daily at 2 AM UTC
- Non-blocking: API searches don't wait for refresh if cache is stale
- Manual refresh endpoint for admins

### 4. **Improved Error Handling**
- Detailed error logging with stack traces
- Development mode returns error details for debugging
- Graceful fallback to API if database is unavailable

---

## Deployment Steps

### Step 1: Run Database Migration

You need to create the `SecCompanyCache` table in your production database.

**Option A: Using Prisma (Recommended if no schema drift)**
```bash
npx prisma migrate deploy
```

**Option B: Manual SQL (Use if you have schema drift)**
Run the SQL from `migrations/manual-add-sec-cache.sql`:

```sql
CREATE TABLE "opportunity_tracker"."SecCompanyCache" (
    "id" TEXT NOT NULL,
    "cik" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecCompanyCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecCompanyCache_cik_key" ON "opportunity_tracker"."SecCompanyCache"("cik");
CREATE INDEX "SecCompanyCache_name_idx" ON "opportunity_tracker"."SecCompanyCache"("name");
CREATE INDEX "SecCompanyCache_ticker_idx" ON "opportunity_tracker"."SecCompanyCache"("ticker");
```

You can run this directly in your Neon database console or via psql.

### Step 2: Verify Environment Variables in Vercel

Ensure these environment variables are set in Vercel:

1. Go to: https://vercel.com/[your-team]/[your-project]/settings/environment-variables
2. Verify `SEC_USER_AGENT` exists:
   - **Key**: `SEC_USER_AGENT`
   - **Value**: `"OppManager seeligrmatthew@gmail.com"` (or your preferred value)
   - **Environments**: Production, Preview, Development

3. Verify database and Inngest variables exist:
   - `DATABASE_URL`
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`

### Step 3: Deploy to Vercel

Push your changes to trigger deployment:

```bash
git add .
git commit -m "fix: improve SEC company search with database caching and retry logic"
git push origin main
```

Or manually trigger deployment in Vercel dashboard.

### Step 4: Initialize SEC Cache

After deployment, you need to populate the cache with SEC data.

**Option A: Use the Manual Refresh API (Recommended)**

As an ADMIN user, call the refresh endpoint:

```bash
curl -X POST https://workdashboard.vercel.app/api/v1/sec/refresh-cache \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json"
```

Replace `YOUR_AUTH_TOKEN` with your actual auth token (get from browser dev tools → Application → Cookies).

**Option B: Wait for Automatic Refresh**

The Inngest cron job will run daily at 2 AM UTC and populate the cache automatically. The first search after cache is empty will trigger a background refresh.

**Option C: Run Script Locally (if needed)**

```bash
npx tsx scripts/init-sec-cache.ts
```

This will populate the cache in your production database (make sure `DATABASE_URL` points to production).

### Step 5: Test the Fix

1. Go to any opportunity detail page on https://workdashboard.vercel.app
2. Try to edit the opportunity and type in the "Account" autocomplete field
3. Type "Apple" or "Microsoft" and verify:
   - No 500 errors in browser console
   - Companies appear in the dropdown
   - Search is fast (< 1 second)

---

## Files Changed

### New Files
- `src/lib/integrations/sec-edgar-improved.ts` - New integration with database caching and retry logic
- `src/app/api/v1/sec/refresh-cache/route.ts` - Manual cache refresh endpoint (admin only)
- `src/lib/inngest/functions/refresh-sec-cache.ts` - Daily cache refresh cron job
- `scripts/init-sec-cache.ts` - One-time cache initialization script
- `migrations/manual-add-sec-cache.sql` - Manual migration SQL
- `.env.example` - Added `SEC_USER_AGENT` documentation

### Modified Files
- `prisma/schema.prisma` - Added `SecCompanyCache` model
- `src/app/api/v1/sec/search-companies/route.ts` - Updated to use improved integration
- `src/app/api/inngest/route.ts` - Registered new refresh job
- `src/lib/integrations/sec-edgar.ts` - Enhanced error handling (kept for backwards compatibility)

---

## Monitoring & Troubleshooting

### Check if Cache is Populated

Query your database:

```sql
SELECT COUNT(*) FROM "opportunity_tracker"."SecCompanyCache";
```

Expected result: ~13,000 rows

### Check Cache Freshness

```sql
SELECT
  MIN("updatedAt") as oldest,
  MAX("updatedAt") as newest,
  COUNT(*) as total
FROM "opportunity_tracker"."SecCompanyCache";
```

If `oldest` is > 24 hours old, the cache needs refresh.

### View Logs in Vercel

1. Go to Vercel dashboard → Your project → Logs
2. Filter by:
   - Function: `/api/v1/sec/search-companies`
   - Time: Last hour
3. Look for error messages:
   - "Using cached company tickers data" = cache hit (good!)
   - "Fetching fresh company tickers data from SEC..." = cache miss (normal on first run)
   - "SEC API error" = check if SEC_USER_AGENT is set correctly

### View Inngest Job Status

1. Go to: https://app.inngest.com
2. Navigate to your app → Functions
3. Find "refresh-sec-cache" function
4. Check execution history and logs

### Common Issues

**Issue: "SEC API error: 403 Forbidden"**
- Cause: Missing or invalid `SEC_USER_AGENT`
- Fix: Set `SEC_USER_AGENT` in Vercel environment variables

**Issue: "Failed to search companies" with database error**
- Cause: `SecCompanyCache` table doesn't exist
- Fix: Run the migration SQL (Step 1)

**Issue: Search returns empty results**
- Cause: Cache is empty
- Fix: Run manual refresh (Step 4)

**Issue: Slow first search (> 5 seconds)**
- Expected: First search after cache expiry triggers background refresh
- Fix: None needed - subsequent searches will be fast

---

## Rollback Plan

If the new implementation causes issues:

1. Revert `src/app/api/v1/sec/search-companies/route.ts`:
   ```typescript
   import { searchCompaniesByName } from "@/lib/integrations/sec-edgar"; // Change back to old file
   ```

2. Redeploy

The old integration is still available and functional.

---

## Performance Improvements

### Before
- Every search fetched 1.5MB JSON from SEC API
- No caching in serverless environment
- Timeout issues on slow networks
- Rate limiting from SEC API

### After
- Searches query local database (< 100ms)
- 24-hour cache reduces SEC API calls by 99%
- Retry logic handles transient failures
- Background refresh prevents user-facing delays

### Metrics

**Expected performance:**
- First search after cache refresh: 200-500ms
- Subsequent searches: 50-100ms
- Cache refresh (background): 2-3 minutes
- Database storage: ~5MB for 13,000 companies

---

## Future Improvements (Optional)

1. **Fuzzy Matching**: Use PostgreSQL `pg_trgm` extension for better search results
2. **Redis Cache**: Add Redis layer for even faster searches (< 10ms)
3. **Webhook Integration**: Subscribe to SEC updates for real-time cache updates
4. **Pre-warming**: Populate cache during build time using Vercel build hooks

---

## Questions?

If you encounter any issues during deployment:
1. Check Vercel function logs
2. Check Inngest job logs
3. Verify database migration was successful
4. Ensure `SEC_USER_AGENT` is set in Vercel

For urgent issues, you can temporarily disable the feature by returning an empty array in the search endpoint.
