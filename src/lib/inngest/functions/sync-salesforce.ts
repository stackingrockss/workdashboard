/**
 * Inngest background job for syncing Salesforce data
 *
 * This job handles bidirectional sync:
 * 1. Imports Accounts, Contacts, Opportunities from Salesforce
 * 2. Exports local changes to Salesforce
 */

import { inngest } from '@/lib/inngest/client';
import { prisma } from '@/lib/db';
import { createSalesforceClient } from '@/lib/integrations/salesforce';
import {
  performFullImport,
  performFullExport,
  performBidirectionalSync,
  type ImportResult,
  type ExportResult,
} from '@/lib/integrations/salesforce/sync';

/**
 * Scheduled job that syncs Salesforce data for all enabled integrations
 * Runs every hour
 */
export const syncSalesforceCron = inngest.createFunction(
  {
    id: 'sync-salesforce-cron',
    name: 'Sync Salesforce (Scheduled)',
  },
  { cron: '0 * * * *' }, // Every hour
  async ({ step }) => {
    // Find all organizations with enabled Salesforce integrations
    const integrations = await step.run('fetch-enabled-integrations', async () => {
      return prisma.salesforceIntegration.findMany({
        where: { isEnabled: true },
        select: {
          organizationId: true,
          syncIntervalMinutes: true,
          lastSyncAt: true,
          syncDirection: true,
        },
      });
    });

    if (integrations.length === 0) {
      return { message: 'No enabled Salesforce integrations found' };
    }

    // Filter to only integrations that need syncing based on their interval
    const now = new Date();
    const integrationsToSync = integrations.filter((integration) => {
      if (!integration.lastSyncAt) {
        return true; // Never synced, sync now
      }

      // Inngest serializes dates as strings, so we need to convert back
      const lastSyncDate = new Date(integration.lastSyncAt);
      const minutesSinceLastSync =
        (now.getTime() - lastSyncDate.getTime()) / (1000 * 60);

      return minutesSinceLastSync >= integration.syncIntervalMinutes;
    });

    if (integrationsToSync.length === 0) {
      return { message: 'No integrations need syncing at this time' };
    }

    // Trigger individual sync jobs for each organization
    const events = integrationsToSync.map((integration) => ({
      name: 'salesforce/sync.scheduled' as const,
      data: {
        organizationId: integration.organizationId,
        fullSync: false,
        direction: integration.syncDirection,
      },
    }));

    await step.sendEvent('trigger-org-syncs', events);

    return {
      message: `Triggered sync for ${integrationsToSync.length} organizations`,
      organizationCount: integrationsToSync.length,
    };
  }
);

/**
 * Job to sync Salesforce data for a single organization
 * Can be triggered manually or by the scheduled cron job
 */
export const syncSalesforceForOrg = inngest.createFunction(
  {
    id: 'sync-salesforce-org',
    name: 'Sync Salesforce for Organization',
    retries: 2,
  },
  [
    { event: 'salesforce/sync.manual' },
    { event: 'salesforce/sync.scheduled' },
  ],
  async ({ event, step }) => {
    const { organizationId, fullSync = false, direction = 'bidirectional' } = event.data;

    // Step 1: Update status to in_progress
    await step.run('set-status-in-progress', async () => {
      await prisma.salesforceIntegration.update({
        where: { organizationId },
        data: {
          lastSyncStatus: 'in_progress',
          lastSyncError: null,
        },
      });
    });

    // Step 2: Create Salesforce client
    const client = await step.run('create-client', async () => {
      const salesforceClient = await createSalesforceClient(organizationId);

      if (!salesforceClient) {
        throw new Error('Failed to create Salesforce client - integration may be disabled or credentials invalid');
      }

      // Test connection
      const isConnected = await salesforceClient.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to Salesforce - please reconnect');
      }

      return true; // Can't return the client directly (not serializable)
    });

    if (!client) {
      await step.run('set-status-failed-client', async () => {
        await prisma.salesforceIntegration.update({
          where: { organizationId },
          data: {
            lastSyncStatus: 'failed',
            lastSyncError: 'Failed to create Salesforce client',
          },
        });
      });
      return { success: false, error: 'Failed to create client' };
    }

    // Step 3: Get the last sync cursor for incremental sync
    const syncOptions = await step.run('get-sync-options', async () => {
      const integration = await prisma.salesforceIntegration.findUnique({
        where: { organizationId },
        select: { syncCursor: true, syncDirection: true },
      });

      return {
        fullSync,
        modifiedSince: fullSync ? undefined : integration?.syncCursor || undefined,
        direction: integration?.syncDirection || direction,
      };
    });

    // Step 4: Perform sync based on direction
    let importResult: ImportResult | null = null;
    let exportResult: ExportResult | null = null;

    // Import from Salesforce (if not export_only)
    if (syncOptions.direction !== 'export_only') {
      importResult = await step.run('import-from-salesforce', async () => {
        const salesforceClient = await createSalesforceClient(organizationId);
        if (!salesforceClient) {
          throw new Error('Failed to create Salesforce client');
        }

        const modifiedSince = syncOptions.modifiedSince
          ? new Date(syncOptions.modifiedSince)
          : undefined;

        return performFullImport(salesforceClient, organizationId, {
          fullSync: syncOptions.fullSync,
          modifiedSince,
        });
      });
    }

    // Export to Salesforce (if not import_only)
    if (syncOptions.direction !== 'import_only') {
      exportResult = await step.run('export-to-salesforce', async () => {
        const salesforceClient = await createSalesforceClient(organizationId);
        if (!salesforceClient) {
          throw new Error('Failed to create Salesforce client');
        }

        return performFullExport(salesforceClient, organizationId);
      });
    }

    // Step 5: Update sync status
    await step.run('update-sync-status', async () => {
      const allErrors: string[] = [];

      if (importResult) {
        allErrors.push(...importResult.accounts.errors);
        allErrors.push(...importResult.contacts.errors);
        allErrors.push(...importResult.opportunities.errors);
      }

      if (exportResult) {
        allErrors.push(...exportResult.accounts.errors);
        allErrors.push(...exportResult.contacts.errors);
        allErrors.push(...exportResult.opportunities.errors);
      }

      const success =
        (importResult?.success ?? true) && (exportResult?.success ?? true);

      await prisma.salesforceIntegration.update({
        where: { organizationId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: success ? 'success' : 'failed',
          lastSyncError: allErrors.length > 0
            ? allErrors.slice(0, 3).join('; ')
            : null,
          syncCursor: new Date(),
        },
      });
    });

    // Build result summary
    const emptyStats = { created: 0, updated: 0, skipped: 0, errorCount: 0 };

    return {
      success:
        (importResult?.success ?? true) && (exportResult?.success ?? true),
      import: importResult
        ? {
            accounts: {
              created: importResult.accounts.created,
              updated: importResult.accounts.updated,
              skipped: importResult.accounts.skipped,
              errorCount: importResult.accounts.errors.length,
            },
            contacts: {
              created: importResult.contacts.created,
              updated: importResult.contacts.updated,
              skipped: importResult.contacts.skipped,
              errorCount: importResult.contacts.errors.length,
            },
            opportunities: {
              created: importResult.opportunities.created,
              updated: importResult.opportunities.updated,
              skipped: importResult.opportunities.skipped,
              errorCount: importResult.opportunities.errors.length,
            },
            duration: importResult.duration,
          }
        : { accounts: emptyStats, contacts: emptyStats, opportunities: emptyStats, duration: 0 },
      export: exportResult
        ? {
            accounts: {
              created: exportResult.accounts.created,
              updated: exportResult.accounts.updated,
              skipped: exportResult.accounts.skipped,
              errorCount: exportResult.accounts.errors.length,
            },
            contacts: {
              created: exportResult.contacts.created,
              updated: exportResult.contacts.updated,
              skipped: exportResult.contacts.skipped,
              errorCount: exportResult.contacts.errors.length,
            },
            opportunities: {
              created: exportResult.opportunities.created,
              updated: exportResult.opportunities.updated,
              skipped: exportResult.opportunities.skipped,
              errorCount: exportResult.opportunities.errors.length,
            },
            duration: exportResult.duration,
          }
        : { accounts: emptyStats, contacts: emptyStats, opportunities: emptyStats, duration: 0 },
    };
  }
);
