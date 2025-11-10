# Inngest Setup Guide

This guide explains how to set up and use Inngest for reliable background job processing in the Opportunity Tracker app.

## What Was Changed

### ✅ Files Created
1. `src/lib/inngest/client.ts` - Inngest client configuration
2. `src/lib/inngest/functions/parse-gong-transcript.ts` - Background job function for parsing transcripts
3. `src/app/api/inngest/route.ts` - API endpoint for Inngest to call

### ✅ Files Modified
1. `src/lib/ai/background-transcript-parsing.ts` - Now uses Inngest instead of Promise.resolve()
2. `.env.local` - Added Inngest configuration comments

## Why Inngest?

The previous implementation used `Promise.resolve().then()` which **doesn't work in serverless environments** like Vercel:

**Problem:**
- API returns response immediately
- Vercel terminates the function execution
- Background job is killed mid-execution
- Database status stuck at "parsing" forever

**Solution (Inngest):**
- Job is queued in Inngest's infrastructure
- Runs to completion even after API response
- Automatic retries on failure (3x by default)
- Full observability dashboard
- **Free tier: 50,000 jobs/month**

---

## Local Development Setup

### 1. Install Inngest CLI (already done)
```bash
npm install inngest
```

### 2. Start Inngest Dev Server
Open a new terminal and run:
```bash
npx inngest-cli@latest dev
```

This will:
- Start the Inngest Dev Server on `http://localhost:8288`
- Open the Inngest dashboard in your browser
- Connect to your Next.js app at `http://localhost:3000/api/inngest`

### 3. Start Your Next.js Dev Server
In another terminal:
```bash
npm run dev
```

### 4. Test the Integration
Run the test script:
```bash
npx tsx test-inngest-parsing.ts
```

Then check:
- Inngest dashboard at `http://localhost:8288`
- You should see the job running/completed
- Check database to see parsing results

---

## Production Setup (Vercel)

### 1. Sign Up for Inngest
1. Go to https://app.inngest.com/sign-up
2. Sign up (free - no credit card required)
3. Create a new app called "opportunity-tracker"

### 2. Get Your Keys
1. Go to **Settings → Keys** in Inngest dashboard
2. Copy your **Signing Key** and **Event Key**

### 3. Add Environment Variables to Vercel
Add these to your Vercel project settings (Settings → Environment Variables):

```
INNGEST_SIGNING_KEY=your-signing-key-here
INNGEST_EVENT_KEY=your-event-key-here
```

### 4. Deploy
```bash
git add .
git commit -m "feat: add Inngest for reliable background job processing"
git push
```

Vercel will automatically detect the `/api/inngest` endpoint and configure it.

### 5. Sync Your App with Inngest
After deployment:
1. Go to Inngest dashboard → **Apps**
2. Click **Sync** next to your app
3. Inngest will discover your job functions automatically

---

## How It Works

### Flow Diagram

```
User uploads transcript
         ↓
API creates GongCall record
         ↓
triggerTranscriptParsing() sends event to Inngest
         ↓
API returns 200 OK immediately ✅
         ↓
[Background] Inngest runs parseGongTranscriptJob
         ↓
Job updates database with results
         ↓
User sees parsed data on refresh
```

### Job Steps (Visible in Dashboard)

1. **update-status-parsing** - Set status to "parsing"
2. **parse-transcript** - Call Gemini API to parse transcript
3. **save-parsed-results** - Save results to database
4. **update-opportunity-history** - Update opportunity history fields

Each step is retried independently if it fails.

---

## Testing the Fix for the Stuck Call

### Option 1: Via Test Script (Local)
```bash
npx tsx test-inngest-parsing.ts
```

Then watch the Inngest dashboard at `http://localhost:8288`

### Option 2: Via Production (If Deployed)
After deploying with Inngest keys:

1. Go to your production app
2. Navigate to the opportunity with the stuck call
3. Click "Retry Parsing" (if you add this button)
4. Or manually trigger via Inngest dashboard

### Option 3: Manual Database Fix (Quick)
If you just want to unstuck the current call without testing:
```bash
npx tsx fix-stuck-call.ts
```

This just changes the status from "parsing" to "completed" or "failed".

---

## Monitoring Jobs

### Local Development
- Dashboard: `http://localhost:8288`
- Shows all jobs, runs, logs, and timing

### Production
- Dashboard: `https://app.inngest.com`
- Same features as local
- Email notifications on failures (optional)

---

## Adding More Background Jobs

To add a new job (e.g., sending email notifications):

1. Create job function in `src/lib/inngest/functions/send-email.ts`:
```typescript
import { inngest } from "@/lib/inngest/client";

export const sendEmailJob = inngest.createFunction(
  { id: "send-email", name: "Send Email Notification" },
  { event: "email/send" },
  async ({ event }) => {
    // Your email sending logic
  }
);
```

2. Register in `src/app/api/inngest/route.ts`:
```typescript
import { sendEmailJob } from "@/lib/inngest/functions/send-email";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    parseGongTranscriptJob,
    sendEmailJob, // Add here
  ],
});
```

3. Trigger from anywhere:
```typescript
await inngest.send({
  name: "email/send",
  data: { to: "user@example.com", subject: "Hello" },
});
```

---

## Troubleshooting

### "Job not running in local dev"
- Make sure Inngest Dev Server is running: `npx inngest-cli@latest dev`
- Make sure Next.js dev server is running: `npm run dev`
- Check that `/api/inngest` is accessible

### "Job failing with API key error"
- Make sure `GEMINI_API_KEY` is set in `.env.local` (local) or Vercel (production)
- Restart your dev server after adding the key

### "Job not appearing in Inngest dashboard (production)"
- Make sure `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` are set in Vercel
- Redeploy your app
- Click "Sync" in Inngest dashboard → Apps

---

## Cost

**Free Tier (Current):**
- 50,000 job runs/month
- Unlimited functions
- Unlimited retries
- Full observability

**Your Usage:**
- ~10-50 calls/day = ~300-1,500 jobs/month
- Well within free tier limits

**Paid Tier (If needed later):**
- Starts at $20/month for 200K jobs
- You won't need this unless processing 1,000+ calls/day

---

## Benefits Over Previous Approach

| Feature | Old (Promise.resolve) | New (Inngest) |
|---------|----------------------|---------------|
| **Reliability** | ❌ Jobs killed by Vercel | ✅ Always completes |
| **Retries** | ❌ Manual | ✅ Automatic (3x) |
| **Observability** | ❌ Console logs only | ✅ Full dashboard |
| **Error tracking** | ❌ Lost on failure | ✅ Captured & logged |
| **Debugging** | ❌ Hard to trace | ✅ Step-by-step view |
| **Scalability** | ❌ Limited | ✅ Unlimited |

---

## Next Steps

1. **Test locally** - Run the test script and verify in dashboard
2. **Sign up for Inngest** - Create account (free)
3. **Add keys to Vercel** - Configure production environment
4. **Deploy** - Push to production
5. **Monitor** - Watch jobs complete successfully

No more stuck parsing jobs! 🎉
