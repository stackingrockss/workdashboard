/**
 * Salesforce Sync Logic
 *
 * Handles importing data from Salesforce into the app
 * and exporting app data to Salesforce (bidirectional sync)
 */

import { prisma } from '@/lib/db';
import type { SalesforceClient } from './client';
import {
  buildUserIdMap,
  buildReverseUserIdMap,
  mapSalesforceToAccount,
  isSalesforceAccountNewer,
  mapAccountToSalesforce,
  mapSalesforceToContact,
  isSalesforceContactNewer,
  mapContactToSalesforce,
  mapSalesforceToOpportunity,
  isSalesforceOpportunityNewer,
  mapOpportunityToSalesforce,
  type UserIdMap,
  type AccountIdMap,
} from './mappers';

/**
 * Import statistics
 */
export interface ImportStats {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Full import result
 */
export interface ImportResult {
  success: boolean;
  accounts: ImportStats;
  contacts: ImportStats;
  opportunities: ImportStats;
  duration: number;
}

/**
 * Import options
 */
export interface ImportOptions {
  fullSync?: boolean; // If true, reimport all data
  modifiedSince?: Date; // Only import records modified after this date
}

/**
 * Import Accounts from Salesforce
 */
export async function importAccountsFromSalesforce(
  client: SalesforceClient,
  organizationId: string,
  userIdMap: UserIdMap,
  options?: ImportOptions
): Promise<{ stats: ImportStats; accountIdMap: AccountIdMap }> {
  const stats: ImportStats = { created: 0, updated: 0, skipped: 0, errors: [] };
  const accountIdMap: AccountIdMap = new Map();

  try {
    // Query Salesforce accounts
    const sfAccounts = await client.queryAccounts({
      modifiedSince: options?.fullSync ? undefined : options?.modifiedSince,
      limit: 2000, // Reasonable limit per sync
    });

    // Get existing accounts with Salesforce IDs
    const existingAccounts = await prisma.account.findMany({
      where: {
        organizationId,
        salesforceId: { not: null },
      },
      select: {
        id: true,
        salesforceId: true,
        salesforceLastModified: true,
      },
    });

    // Build existing account map
    const existingBysfId = new Map(
      existingAccounts.map((a) => [a.salesforceId!, a])
    );

    // Process each Salesforce account
    for (const sfAccount of sfAccounts) {
      try {
        const existing = existingBysfId.get(sfAccount.Id);
        const importData = mapSalesforceToAccount(sfAccount, organizationId, userIdMap);

        if (existing) {
          // Check if Salesforce version is newer
          if (isSalesforceAccountNewer(sfAccount, existing)) {
            await prisma.account.update({
              where: { id: existing.id },
              data: {
                name: importData.name,
                website: importData.website,
                industry: importData.industry,
                ownerId: importData.ownerId,
                salesforceLastSyncAt: importData.salesforceLastSyncAt,
                salesforceLastModified: importData.salesforceLastModified,
              },
            });
            stats.updated++;
          } else {
            stats.skipped++;
          }
          accountIdMap.set(sfAccount.Id, existing.id);
        } else {
          // Create new account
          const newAccount = await prisma.account.create({
            data: {
              name: importData.name,
              website: importData.website,
              industry: importData.industry,
              ownerId: importData.ownerId,
              organizationId: importData.organizationId,
              salesforceId: importData.salesforceId,
              salesforceLastSyncAt: importData.salesforceLastSyncAt,
              salesforceLastModified: importData.salesforceLastModified,
            },
          });
          stats.created++;
          accountIdMap.set(sfAccount.Id, newAccount.id);
        }
      } catch (error) {
        const msg = `Account ${sfAccount.Name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(msg);
        console.error('Account import error:', msg);
      }
    }

    // Also add existing accounts to map (for contacts/opportunities that reference them)
    for (const account of existingAccounts) {
      if (!accountIdMap.has(account.salesforceId!)) {
        accountIdMap.set(account.salesforceId!, account.id);
      }
    }
  } catch (error) {
    stats.errors.push(`Failed to query accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { stats, accountIdMap };
}

/**
 * Import Contacts from Salesforce
 */
export async function importContactsFromSalesforce(
  client: SalesforceClient,
  organizationId: string,
  accountIdMap: AccountIdMap,
  options?: ImportOptions
): Promise<ImportStats> {
  const stats: ImportStats = { created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    // Query Salesforce contacts
    const sfContacts = await client.queryContacts({
      modifiedSince: options?.fullSync ? undefined : options?.modifiedSince,
      limit: 5000,
    });

    // Get existing contacts with Salesforce IDs
    const existingContacts = await prisma.contact.findMany({
      where: {
        salesforceId: { not: null },
        account: { organizationId },
      },
      select: {
        id: true,
        salesforceId: true,
        salesforceLastSyncAt: true,
      },
    });

    const existingBysfId = new Map(
      existingContacts.map((c) => [c.salesforceId!, c])
    );

    for (const sfContact of sfContacts) {
      try {
        const existing = existingBysfId.get(sfContact.Id);
        const importData = mapSalesforceToContact(sfContact, accountIdMap);

        // Skip contacts without a linked account in our system
        if (!importData.accountId && sfContact.AccountId) {
          stats.skipped++;
          continue;
        }

        if (existing) {
          if (isSalesforceContactNewer(sfContact, existing)) {
            await prisma.contact.update({
              where: { id: existing.id },
              data: {
                firstName: importData.firstName,
                lastName: importData.lastName,
                title: importData.title,
                email: importData.email,
                phone: importData.phone,
                accountId: importData.accountId,
                salesforceLastSyncAt: importData.salesforceLastSyncAt,
              },
            });
            stats.updated++;
          } else {
            stats.skipped++;
          }
        } else {
          // Only create contact if it has an account
          if (importData.accountId) {
            await prisma.contact.create({
              data: {
                firstName: importData.firstName,
                lastName: importData.lastName,
                title: importData.title,
                email: importData.email,
                phone: importData.phone,
                role: importData.role,
                accountId: importData.accountId,
                salesforceId: importData.salesforceId,
                salesforceLastSyncAt: importData.salesforceLastSyncAt,
              },
            });
            stats.created++;
          } else {
            stats.skipped++;
          }
        }
      } catch (error) {
        const msg = `Contact ${sfContact.LastName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(msg);
        console.error('Contact import error:', msg);
      }
    }
  } catch (error) {
    stats.errors.push(`Failed to query contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return stats;
}

/**
 * Import Opportunities from Salesforce
 */
export async function importOpportunitiesFromSalesforce(
  client: SalesforceClient,
  organizationId: string,
  userIdMap: UserIdMap,
  accountIdMap: AccountIdMap,
  options?: ImportOptions
): Promise<ImportStats> {
  const stats: ImportStats = { created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    // Query Salesforce opportunities
    const sfOpportunities = await client.queryOpportunities({
      modifiedSince: options?.fullSync ? undefined : options?.modifiedSince,
      limit: 2000,
    });

    // Get existing opportunities with Salesforce IDs
    const existingOpportunities = await prisma.opportunity.findMany({
      where: {
        organizationId,
        salesforceId: { not: null },
      },
      select: {
        id: true,
        salesforceId: true,
        salesforceLastModified: true,
      },
    });

    const existingBysfId = new Map(
      existingOpportunities.map((o) => [o.salesforceId!, o])
    );

    for (const sfOpp of sfOpportunities) {
      try {
        const existing = existingBysfId.get(sfOpp.Id);
        const importData = mapSalesforceToOpportunity(
          sfOpp,
          organizationId,
          userIdMap,
          accountIdMap
        );

        if (existing) {
          if (isSalesforceOpportunityNewer(sfOpp, existing)) {
            await prisma.opportunity.update({
              where: { id: existing.id },
              data: {
                name: importData.name,
                amountArr: importData.amountArr,
                closeDate: importData.closeDate,
                stage: importData.stage,
                confidenceLevel: importData.confidenceLevel,
                nextStep: importData.nextStep,
                notes: importData.notes,
                forecastCategory: importData.forecastCategory,
                ownerId: importData.ownerId,
                accountId: importData.accountId,
                salesforceLastSyncAt: importData.salesforceLastSyncAt,
                salesforceLastModified: importData.salesforceLastModified,
                salesforceSyncStatus: 'synced',
              },
            });
            stats.updated++;
          } else {
            stats.skipped++;
          }
        } else {
          // Create new opportunity
          await prisma.opportunity.create({
            data: {
              name: importData.name,
              amountArr: importData.amountArr,
              closeDate: importData.closeDate,
              stage: importData.stage,
              confidenceLevel: importData.confidenceLevel,
              nextStep: importData.nextStep,
              notes: importData.notes,
              forecastCategory: importData.forecastCategory,
              ownerId: importData.ownerId,
              accountId: importData.accountId,
              organizationId: importData.organizationId,
              salesforceId: importData.salesforceId,
              salesforceLastSyncAt: importData.salesforceLastSyncAt,
              salesforceLastModified: importData.salesforceLastModified,
              salesforceSyncStatus: 'synced',
            },
          });
          stats.created++;
        }
      } catch (error) {
        const msg = `Opportunity ${sfOpp.Name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(msg);
        console.error('Opportunity import error:', msg);
      }
    }
  } catch (error) {
    stats.errors.push(`Failed to query opportunities: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return stats;
}

/**
 * Perform a full import from Salesforce
 * Import order: Accounts → Contacts → Opportunities
 */
export async function performFullImport(
  client: SalesforceClient,
  organizationId: string,
  options?: ImportOptions
): Promise<ImportResult> {
  const startTime = Date.now();

  // Build user ID mapping first
  const userIdMap = await buildUserIdMap(client, organizationId);

  // Import Accounts
  const { stats: accountStats, accountIdMap } = await importAccountsFromSalesforce(
    client,
    organizationId,
    userIdMap,
    options
  );

  // Import Contacts (depends on accounts)
  const contactStats = await importContactsFromSalesforce(
    client,
    organizationId,
    accountIdMap,
    options
  );

  // Import Opportunities (depends on accounts and users)
  const opportunityStats = await importOpportunitiesFromSalesforce(
    client,
    organizationId,
    userIdMap,
    accountIdMap,
    options
  );

  const duration = Date.now() - startTime;

  // Determine overall success
  const hasErrors =
    accountStats.errors.length > 0 ||
    contactStats.errors.length > 0 ||
    opportunityStats.errors.length > 0;

  return {
    success: !hasErrors,
    accounts: accountStats,
    contacts: contactStats,
    opportunities: opportunityStats,
    duration,
  };
}

// ============================================================================
// EXPORT FUNCTIONS (App → Salesforce)
// ============================================================================

/**
 * Export statistics
 */
export interface ExportStats {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Full export result
 */
export interface ExportResult {
  success: boolean;
  accounts: ExportStats;
  contacts: ExportStats;
  opportunities: ExportStats;
  duration: number;
}

/**
 * Export Accounts to Salesforce
 * Creates new accounts or updates existing ones
 */
export async function exportAccountsToSalesforce(
  client: SalesforceClient,
  organizationId: string,
  userIdMap: UserIdMap
): Promise<{ stats: ExportStats; sfAccountIdMap: Map<string, string> }> {
  const stats: ExportStats = { created: 0, updated: 0, skipped: 0, errors: [] };
  const sfAccountIdMap = new Map<string, string>();

  try {
    // Get accounts that need to be exported:
    // 1. Accounts with no salesforceId (new)
    // 2. Accounts modified since last sync (updated locally)
    const accountsToExport = await prisma.account.findMany({
      where: {
        organizationId,
        OR: [
          { salesforceId: null }, // New accounts
          {
            AND: [
              { salesforceId: { not: null } },
              { salesforceLastSyncAt: { not: null } },
            ],
          },
        ],
      },
    });

    // Filter to only accounts that have been modified since last sync
    const accountsNeedingExport = accountsToExport.filter((account) => {
      if (!account.salesforceId) return true; // New account
      if (!account.salesforceLastSyncAt) return true; // Never synced
      return account.updatedAt > account.salesforceLastSyncAt;
    });

    for (const account of accountsNeedingExport) {
      try {
        const sfData = mapAccountToSalesforce(account, userIdMap);

        if (account.salesforceId) {
          // Update existing Salesforce account
          await client.updateAccount(account.salesforceId, sfData);

          // Update sync timestamp
          await prisma.account.update({
            where: { id: account.id },
            data: {
              salesforceLastSyncAt: new Date(),
              salesforceLastModified: new Date(),
            },
          });

          stats.updated++;
          sfAccountIdMap.set(account.id, account.salesforceId);
        } else {
          // Create new Salesforce account
          const sfId = await client.createAccount(sfData);

          // Store Salesforce ID and sync timestamp
          await prisma.account.update({
            where: { id: account.id },
            data: {
              salesforceId: sfId,
              salesforceLastSyncAt: new Date(),
              salesforceLastModified: new Date(),
            },
          });

          stats.created++;
          sfAccountIdMap.set(account.id, sfId);
        }
      } catch (error) {
        const msg = `Account ${account.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(msg);
        console.error('Account export error:', msg);
      }
    }

    // Also add existing synced accounts to map
    const existingSynced = await prisma.account.findMany({
      where: {
        organizationId,
        salesforceId: { not: null },
      },
      select: { id: true, salesforceId: true },
    });

    for (const account of existingSynced) {
      if (!sfAccountIdMap.has(account.id)) {
        sfAccountIdMap.set(account.id, account.salesforceId!);
      }
    }
  } catch (error) {
    stats.errors.push(`Failed to export accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { stats, sfAccountIdMap };
}

/**
 * Export Contacts to Salesforce
 */
export async function exportContactsToSalesforce(
  client: SalesforceClient,
  organizationId: string,
  sfAccountIdMap: Map<string, string>
): Promise<ExportStats> {
  const stats: ExportStats = { created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    // Get contacts that need to be exported
    const contactsToExport = await prisma.contact.findMany({
      where: {
        account: { organizationId },
        OR: [
          { salesforceId: null },
          {
            AND: [
              { salesforceId: { not: null } },
              { salesforceLastSyncAt: { not: null } },
            ],
          },
        ],
      },
      include: {
        account: { select: { id: true, salesforceId: true } },
      },
    });

    // Filter to only contacts that have been modified since last sync
    const contactsNeedingExport = contactsToExport.filter((contact) => {
      if (!contact.salesforceId) return true;
      if (!contact.salesforceLastSyncAt) return true;
      return contact.updatedAt > contact.salesforceLastSyncAt;
    });

    for (const contact of contactsNeedingExport) {
      try {
        // Skip contacts without an account that has a Salesforce ID
        if (!contact.accountId || !sfAccountIdMap.has(contact.accountId)) {
          stats.skipped++;
          continue;
        }

        const sfData = mapContactToSalesforce(contact, sfAccountIdMap);

        if (contact.salesforceId) {
          // Update existing Salesforce contact
          await client.updateContact(contact.salesforceId, sfData);

          await prisma.contact.update({
            where: { id: contact.id },
            data: { salesforceLastSyncAt: new Date() },
          });

          stats.updated++;
        } else {
          // Create new Salesforce contact
          const sfId = await client.createContact(sfData);

          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              salesforceId: sfId,
              salesforceLastSyncAt: new Date(),
            },
          });

          stats.created++;
        }
      } catch (error) {
        const msg = `Contact ${contact.lastName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(msg);
        console.error('Contact export error:', msg);
      }
    }
  } catch (error) {
    stats.errors.push(`Failed to export contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return stats;
}

/**
 * Export Opportunities to Salesforce
 */
export async function exportOpportunitiesToSalesforce(
  client: SalesforceClient,
  organizationId: string,
  userIdMap: UserIdMap,
  sfAccountIdMap: Map<string, string>
): Promise<ExportStats> {
  const stats: ExportStats = { created: 0, updated: 0, skipped: 0, errors: [] };

  try {
    // Get opportunities that need to be exported:
    // 1. No salesforceId (new)
    // 2. salesforceSyncStatus = 'pending_push' (local changes)
    // 3. Modified since last sync
    const opportunitiesToExport = await prisma.opportunity.findMany({
      where: {
        organizationId,
        OR: [
          { salesforceId: null },
          { salesforceSyncStatus: 'pending_push' },
        ],
      },
    });

    for (const opp of opportunitiesToExport) {
      try {
        const sfData = mapOpportunityToSalesforce(opp, userIdMap, sfAccountIdMap);

        // Salesforce requires CloseDate and StageName
        if (!sfData.CloseDate) {
          sfData.CloseDate = new Date().toISOString().split('T')[0];
        }

        if (opp.salesforceId) {
          // Update existing Salesforce opportunity
          await client.updateOpportunity(opp.salesforceId, sfData);

          await prisma.opportunity.update({
            where: { id: opp.id },
            data: {
              salesforceLastSyncAt: new Date(),
              salesforceLastModified: new Date(),
              salesforceSyncStatus: 'synced',
            },
          });

          stats.updated++;
        } else {
          // Create new Salesforce opportunity
          const sfId = await client.createOpportunity(sfData);

          await prisma.opportunity.update({
            where: { id: opp.id },
            data: {
              salesforceId: sfId,
              salesforceLastSyncAt: new Date(),
              salesforceLastModified: new Date(),
              salesforceSyncStatus: 'synced',
            },
          });

          stats.created++;
        }
      } catch (error) {
        const msg = `Opportunity ${opp.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        stats.errors.push(msg);
        console.error('Opportunity export error:', msg);

        // Mark as pending for retry (only if not already pending)
        if (opp.salesforceSyncStatus !== 'pending_push') {
          await prisma.opportunity.update({
            where: { id: opp.id },
            data: { salesforceSyncStatus: 'pending_push' },
          }).catch(() => {}); // Ignore errors updating status
        }
      }
    }
  } catch (error) {
    stats.errors.push(`Failed to export opportunities: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return stats;
}

/**
 * Perform a full export to Salesforce
 * Export order: Accounts → Contacts → Opportunities
 */
export async function performFullExport(
  client: SalesforceClient,
  organizationId: string
): Promise<ExportResult> {
  const startTime = Date.now();

  // Build user ID mapping (includes both directions)
  const userIdMap = await buildReverseUserIdMap(client, organizationId);

  // Export Accounts first (creates SF IDs we need for contacts/opportunities)
  const { stats: accountStats, sfAccountIdMap } = await exportAccountsToSalesforce(
    client,
    organizationId,
    userIdMap
  );

  // Export Contacts (depends on accounts having SF IDs)
  const contactStats = await exportContactsToSalesforce(
    client,
    organizationId,
    sfAccountIdMap
  );

  // Export Opportunities (depends on accounts and users)
  const opportunityStats = await exportOpportunitiesToSalesforce(
    client,
    organizationId,
    userIdMap,
    sfAccountIdMap
  );

  const duration = Date.now() - startTime;

  const hasErrors =
    accountStats.errors.length > 0 ||
    contactStats.errors.length > 0 ||
    opportunityStats.errors.length > 0;

  return {
    success: !hasErrors,
    accounts: accountStats,
    contacts: contactStats,
    opportunities: opportunityStats,
    duration,
  };
}

/**
 * Perform bidirectional sync
 * 1. Import from Salesforce (get latest SF changes)
 * 2. Export to Salesforce (push local changes)
 */
export async function performBidirectionalSync(
  client: SalesforceClient,
  organizationId: string,
  options?: ImportOptions
): Promise<{
  import: ImportResult;
  export: ExportResult;
}> {
  // First import to get Salesforce changes
  const importResult = await performFullImport(client, organizationId, options);

  // Then export local changes to Salesforce
  const exportResult = await performFullExport(client, organizationId);

  return {
    import: importResult,
    export: exportResult,
  };
}
