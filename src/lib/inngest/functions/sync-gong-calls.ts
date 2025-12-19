/**
 * Inngest background job for syncing Gong calls
 *
 * This job:
 * 1. Fetches calls from Gong API within date range
 * 2. Matches calls to opportunities/accounts by participant emails
 * 3. Creates GongCall records with transcripts
 * 4. Triggers transcript parsing for AI analysis
 */

import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db';
import { decryptToken } from '@/lib/integrations/oauth-helpers';
import {
  createGongClient,
  formatGongTranscript,
  extractExternalEmails,
  matchCallToOpportunity,
  findMatchingCalendarEvent,
  getPrimaryExternalEmail,
  type GongCallData,
  type GongTranscript,
} from '@/lib/integrations/gong';

// How far back to sync on first sync (30 days)
const INITIAL_SYNC_DAYS = 30;
// Maximum calls to process per sync job
const MAX_CALLS_PER_SYNC = 100;

/**
 * Scheduled job that syncs Gong calls for all enabled integrations
 * Runs every hour
 */
export const syncGongCallsCron = inngest.createFunction(
  {
    id: 'sync-gong-calls-cron',
    name: 'Sync Gong Calls (Scheduled)',
  },
  { cron: '0 * * * *' }, // Every hour
  async ({ step }) => {
    // Find all organizations with enabled Gong integrations
    const integrations = await step.run('fetch-enabled-integrations', async () => {
      return prisma.gongIntegration.findMany({
        where: { isEnabled: true },
        select: { organizationId: true },
      });
    });

    if (integrations.length === 0) {
      return { message: 'No enabled Gong integrations found' };
    }

    // Trigger individual sync jobs for each organization
    const events = integrations.map((integration) => ({
      name: 'gong/sync.scheduled' as const,
      data: {
        organizationId: integration.organizationId,
        fullSync: false,
      },
    }));

    await step.sendEvent('trigger-org-syncs', events);

    return {
      message: `Triggered sync for ${integrations.length} organizations`,
      organizationCount: integrations.length,
    };
  }
);

/**
 * Job to sync Gong calls for a single organization
 * Can be triggered manually or by the scheduled cron job
 */
export const syncGongCallsForOrg = inngest.createFunction(
  {
    id: 'sync-gong-calls-org',
    name: 'Sync Gong Calls for Organization',
    retries: 2,
  },
  [
    { event: 'gong/sync.manual' },
    { event: 'gong/sync.scheduled' },
  ],
  async ({ event, step }) => {
    const { organizationId, fullSync = false, triggeredBy } = event.data;

    // Step 1: Fetch integration and decrypt credentials
    const integration = await step.run('fetch-integration', async () => {
      const int = await prisma.gongIntegration.findUnique({
        where: { organizationId },
      });

      if (!int) {
        throw new Error(`No Gong integration found for organization ${organizationId}`);
      }

      if (!int.isEnabled) {
        throw new Error('Gong integration is disabled');
      }

      return {
        id: int.id,
        accessKey: decryptToken(int.accessKey),
        accessKeySecret: decryptToken(int.accessKeySecret),
        lastSyncAt: int.lastSyncAt,
        syncCursor: int.syncCursor,
      };
    });

    // Step 2: Determine date range
    const dateRange = await step.run('determine-date-range', async () => {
      const now = new Date();
      let fromDate: Date;

      if (fullSync || !integration.lastSyncAt) {
        // Full sync: go back INITIAL_SYNC_DAYS
        fromDate = new Date(now.getTime() - INITIAL_SYNC_DAYS * 24 * 60 * 60 * 1000);
      } else {
        // Incremental sync: start from last sync time
        // Use syncCursor if available, otherwise lastSyncAt
        fromDate = integration.syncCursor
          ? new Date(integration.syncCursor)
          : new Date(integration.lastSyncAt);
      }

      return {
        fromDateTime: fromDate.toISOString(),
        toDateTime: now.toISOString(),
      };
    });

    // Step 3: Fetch calls from Gong API
    const gongData = await step.run('fetch-gong-calls', async () => {
      const client = createGongClient(
        integration.accessKey,
        integration.accessKeySecret
      );

      const { calls, hasMore, nextCursor } = await client.fetchAllCalls(
        dateRange.fromDateTime,
        dateRange.toDateTime,
        MAX_CALLS_PER_SYNC
      );

      return { calls, hasMore, nextCursor };
    });

    if (gongData.calls.length === 0) {
      // No new calls, update sync time
      await step.run('update-sync-status-empty', async () => {
        await prisma.gongIntegration.update({
          where: { organizationId },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'success',
            lastSyncError: null,
          },
        });
      });

      return {
        success: true,
        message: 'No new calls to sync',
        callsProcessed: 0,
      };
    }

    // Step 4: Fetch transcripts for all calls
    const transcripts = await step.run('fetch-transcripts', async () => {
      const client = createGongClient(
        integration.accessKey,
        integration.accessKeySecret
      );

      const callIds = gongData.calls.map((c) => c.id);
      const transcriptMap = await client.fetchTranscriptsInBatches(callIds, 50);

      return Object.fromEntries(transcriptMap);
    });

    // Step 5: Process each call
    const results = await step.run('process-calls', async () => {
      const processed: string[] = [];
      const skipped: string[] = [];
      const errors: string[] = [];

      for (const call of gongData.calls) {
        try {
          // Check if call already exists
          const existing = await prisma.gongCall.findUnique({
            where: { gongCallId: call.id },
          });

          if (existing) {
            skipped.push(call.id);
            continue;
          }

          // Match to opportunity/account
          const externalEmails = extractExternalEmails(call.parties);
          const match = await matchCallToOpportunity(externalEmails, organizationId);

          // Format transcript
          const transcript = transcripts[call.id] as GongTranscript | undefined;
          const transcriptText = transcript
            ? formatGongTranscript(transcript, call.parties)
            : null;

          // Find matching calendar event
          const calendarEventId = await findMatchingCalendarEvent(
            new Date(call.started),
            externalEmails,
            organizationId
          );

          // Create GongCall record
          const gongCall = await prisma.gongCall.create({
            data: {
              organizationId,
              opportunityId: match.opportunityId,
              gongCallId: call.id,
              title: call.title || 'Untitled Call',
              url: call.url,
              gongUrl: call.url,
              meetingDate: new Date(call.started),
              duration: call.duration,
              direction: call.direction,
              participants: call.parties,
              primaryParticipantEmail: getPrimaryExternalEmail(call.parties),
              transcriptText,
              calendarEventId,
              syncedAt: new Date(),
              syncSource: 'auto',
              parsingStatus: transcriptText ? 'pending' : null,
            },
          });

          processed.push(call.id);

          // Trigger transcript parsing if we have a transcript and an opportunity
          if (transcriptText && match.opportunityId) {
            await inngest.send({
              name: 'gong/transcript.parse',
              data: {
                gongCallId: gongCall.id,
                transcriptText,
              },
            });
          }
        } catch (error) {
          console.error(`Error processing call ${call.id}:`, error);
          errors.push(`${call.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { processed, skipped, errors };
    });

    // Step 6: Update sync status
    await step.run('update-sync-status', async () => {
      await prisma.gongIntegration.update({
        where: { organizationId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: results.errors.length > 0 ? 'failed' : 'success',
          lastSyncError:
            results.errors.length > 0
              ? results.errors.slice(0, 3).join('; ')
              : null,
          // Save cursor for next incremental sync
          syncCursor: gongData.hasMore
            ? dateRange.toDateTime
            : null,
        },
      });
    });

    return {
      success: results.errors.length === 0,
      callsProcessed: results.processed.length,
      callsSkipped: results.skipped.length,
      errors: results.errors,
      hasMore: gongData.hasMore,
    };
  }
);
