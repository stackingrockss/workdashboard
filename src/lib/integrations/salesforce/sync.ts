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
  mapSalesforceToAccount,
  isSalesforceAccountNewer,
  mapSalesforceToContact,
  isSalesforceContactNewer,
  mapSalesforceToOpportunity,
  isSalesforceOpportunityNewer,
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
