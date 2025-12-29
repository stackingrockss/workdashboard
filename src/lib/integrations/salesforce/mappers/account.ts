/**
 * Salesforce Account Mapper
 *
 * Maps between Salesforce Account and app Account
 */

import type { Account } from '@prisma/client';
import type { SalesforceAccount } from '../types';
import type { UserIdMap } from './user';
import { getAppOwnerId, getSalesforceOwnerId } from './user';

/**
 * Input type for creating/updating an Account from Salesforce
 */
export interface AccountImportData {
  name: string;
  website: string | null;
  industry: string | null;
  salesforceId: string;
  salesforceLastSyncAt: Date;
  salesforceLastModified: Date;
  ownerId: string | null;
  organizationId: string;
}

/**
 * Map a Salesforce Account to app Account format
 */
export function mapSalesforceToAccount(
  sfAccount: SalesforceAccount,
  organizationId: string,
  userIdMap: UserIdMap
): AccountImportData {
  return {
    name: sfAccount.Name,
    website: sfAccount.Website || null,
    industry: sfAccount.Industry || null,
    salesforceId: sfAccount.Id,
    salesforceLastSyncAt: new Date(),
    salesforceLastModified: new Date(sfAccount.LastModifiedDate),
    ownerId: sfAccount.OwnerId ? getAppOwnerId(sfAccount.OwnerId, userIdMap) : null,
    organizationId,
  };
}

/**
 * Map an app Account to Salesforce Account format
 */
export function mapAccountToSalesforce(
  account: Account,
  userIdMap: UserIdMap
): Partial<SalesforceAccount> {
  const sfAccount: Partial<SalesforceAccount> = {
    Name: account.name,
  };

  if (account.website) {
    sfAccount.Website = account.website;
  }

  if (account.industry) {
    sfAccount.Industry = account.industry;
  }

  if (account.ownerId) {
    const sfOwnerId = getSalesforceOwnerId(account.ownerId, userIdMap);
    if (sfOwnerId) {
      sfAccount.OwnerId = sfOwnerId;
    }
  }

  return sfAccount;
}

/**
 * Check if Salesforce account is newer than local account
 */
export function isSalesforceAccountNewer(
  sfAccount: SalesforceAccount,
  localAccount: { salesforceLastModified: Date | null } | null
): boolean {
  if (!localAccount?.salesforceLastModified) {
    return true; // No local record or no sync timestamp
  }

  const sfModified = new Date(sfAccount.LastModifiedDate);
  return sfModified > localAccount.salesforceLastModified;
}
