# Inngest Setup Guide

This application uses [Inngest](https://www.inngest.com/) for background job processing, including:
- Parsing Gong call transcripts
- **Risk analysis** for Gong calls
- Consolidating insights from multiple calls
- Processing SEC filings and earnings transcripts
- Syncing calendar events and Google tasks

## Local Development Setup

### Prerequisites
- Next.js dev server running (`npm run dev`)
- Inngest Dev Server running (required for background jobs)

### Step 1: Start the Next.js Development Server

```bash
npm run dev
```

This starts your Next.js app at `http://localhost:3000`

### Step 2: Start the Inngest Dev Server

**In a separate terminal window**, run:

```bash
npm run dev:inngest
```

This starts the Inngest Dev Server at `http://localhost:8288`

The Inngest Dev Server:
- Processes background jobs locally
- Provides a dashboard to monitor job execution
- Shows logs and errors for debugging

### Step 3: Verify Setup

1. Open the Inngest dashboard: `http://localhost:8288`
2. You should see your registered functions:
   - `parse-gong-transcript`
   - **`analyze-call-risk`** ← This is what generates risk assessments
   - `consolidate-insights`
   - `process-sec-filing`
   - `process-earnings-transcript`
   - `sync-calendar-events`
   - `sync-google-tasks`

## Testing Risk Analysis

### Automatic Trigger (after parsing)
When you upload a Gong call transcript, the system automatically:
1. Parses the transcript (extracts pain points, goals, people, next steps)
2. **Triggers risk analysis** via the `gong/risk.analyze` event
3. Risk analysis runs asynchronously and saves results to the database

**Important**: This only works if the Inngest Dev Server is running!

### Manual Trigger (API endpoint)
You can manually trigger risk analysis for any completed Gong call:

```bash
curl -X POST http://localhost:3000/api/v1/gong-calls/{callId}/analyze-risk
```

Or use the **"Run Analysis" button** in the Transcript Insights dialog when risk assessment is pending.

### Backfill Missing Risk Assessments

If you have Gong calls that were parsed before the Inngest Dev Server was running, you can backfill them:

```bash
# Check which calls are missing risk assessments
npx tsx scripts/check-gong-risk-status.ts

# Manually trigger risk analysis for a specific call
curl -X POST http://localhost:3000/api/v1/gong-calls/{callId}/analyze-risk
```

## Environment Variables

Ensure these are set in your `.env.local`:

```env
INNGEST_SIGNING_KEY="signkey-prod-..."
INNGEST_EVENT_KEY="..."
```

## Troubleshooting

### Jobs not running?
- ✅ Verify Inngest Dev Server is running (`npm run dev:inngest`)
- ✅ Check the Inngest dashboard at `http://localhost:8288`
- ✅ Look for errors in both terminal windows (Next.js and Inngest)

### Risk assessment still pending?
- ✅ Make sure the Gong call has `parsingStatus: "completed"`
- ✅ Check Inngest dashboard for failed jobs
- ✅ Try manually triggering via the API or UI button

### Jobs failing with API errors?
- ✅ Check that `GOOGLE_AI_API_KEY` is set (risk analysis uses Gemini)
- ✅ Verify you're not hitting rate limits
- ✅ Check Inngest logs for detailed error messages

## Production Deployment

In production (Vercel), Inngest Cloud handles job processing automatically:
- No need to run a separate dev server
- Jobs are processed reliably with retries
- Monitor jobs via Inngest Cloud dashboard

### Production Setup
1. Create an Inngest Cloud account
2. Add your app's URL to Inngest Cloud
3. Set environment variables in Vercel:
   - `INNGEST_SIGNING_KEY`
   - `INNGEST_EVENT_KEY`

## Learn More

- [Inngest Documentation](https://www.inngest.com/docs)
- [Inngest Dev Server Guide](https://www.inngest.com/docs/local-development)
- [Inngest Cloud Dashboard](https://app.inngest.com/)
