// src/app/api/inngest/route.ts
// Inngest API endpoint for handling background jobs

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { parseGongTranscriptJob } from "@/lib/inngest/functions/parse-gong-transcript";
import { analyzeCallRiskJob } from "@/lib/inngest/functions/analyze-call-risk";
import { parseGranolaTranscriptJob } from "@/lib/inngest/functions/parse-granola-transcript";
import { analyzeGranolaRiskJob } from "@/lib/inngest/functions/analyze-granola-risk";
import { consolidateInsightsJob } from "@/lib/inngest/functions/consolidate-insights";
import { checkConsolidationJob } from "@/lib/inngest/functions/check-consolidation";
import { syncAllCalendarEventsJob } from "@/lib/inngest/functions/sync-calendar-events";
import { syncAllGoogleTasksJob } from "@/lib/inngest/functions/sync-google-tasks";
import { processSecFilingJob } from "@/lib/inngest/functions/process-sec-filing";
import { processEarningsTranscriptJob } from "@/lib/inngest/functions/process-earnings-transcript";
import { refreshSecCacheJob } from "@/lib/inngest/functions/refresh-sec-cache";
import { syncEarningsDatesJob } from "@/lib/inngest/functions/sync-earnings-dates";
import { generateAccountResearchJob } from "@/lib/inngest/functions/generate-account-research";
import { recalculateNextCallDatesJob } from "@/lib/inngest/functions/recalculate-next-call-dates";
import { generateMapJob } from "@/lib/inngest/functions/generate-map";
import { generateFrameworkContentJob } from "@/lib/inngest/functions/generate-framework-content";
import { generateDocumentContentJob } from "@/lib/inngest/functions/generate-document-content";
import { syncGongCallsCron, syncGongCallsForOrg } from "@/lib/inngest/functions/sync-gong-calls";
import { syncDatabaseBackupJob, fullDatabaseSyncJob } from "@/lib/inngest/functions/sync-database-backup";

// Increase timeout for long-running AI jobs
// Vercel Pro: 300s (5 min), Hobby: 60s max
export const maxDuration = 300;

/**
 * Inngest endpoint handler
 * This route handles all Inngest job execution and webhook events
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    parseGongTranscriptJob,
    analyzeCallRiskJob,
    parseGranolaTranscriptJob, // NEW: Granola transcript parsing
    analyzeGranolaRiskJob, // NEW: Granola risk analysis
    checkConsolidationJob, // Lightweight job to check & trigger consolidation
    consolidateInsightsJob,
    syncAllCalendarEventsJob,
    syncAllGoogleTasksJob, // Google Tasks background sync (every 15 minutes)
    processSecFilingJob, // SEC EDGAR 10-K filing processing
    processEarningsTranscriptJob, // Earnings call transcript processing
    refreshSecCacheJob, // SEC company data cache refresh (daily at 2 AM UTC)
    syncEarningsDatesJob, // Earnings dates sync and reminder tasks (daily at 9 AM)
    generateAccountResearchJob, // AI account research generation on opportunity creation
    recalculateNextCallDatesJob, // Next call date recalculation (daily at 2 AM)
    generateMapJob, // Mutual Action Plan generation
    generateFrameworkContentJob, // AI content generation using frameworks (legacy GeneratedContent)
    generateDocumentContentJob, // AI content generation for Document table (unified system)
    syncGongCallsCron, // Gong calls sync (hourly cron)
    syncGongCallsForOrg, // Gong calls sync for single org (manual or scheduled)
    syncDatabaseBackupJob, // CDC sync to backup database (every 12 hours)
    fullDatabaseSyncJob, // Full database sync (manual trigger via event)
  ],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
