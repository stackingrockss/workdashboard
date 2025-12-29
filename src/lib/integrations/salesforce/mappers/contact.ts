/**
 * Salesforce Contact Mapper
 *
 * Maps between Salesforce Contact and app Contact
 */

import type { Contact, ContactRole } from '@prisma/client';
import type { SalesforceContact } from '../types';

/**
 * Input type for creating/updating a Contact from Salesforce
 */
export interface ContactImportData {
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  role: ContactRole;
  salesforceId: string;
  salesforceLastSyncAt: Date;
  accountId: string | null;
}

/**
 * Salesforce Account ID → App Account ID map
 */
export type AccountIdMap = Map<string, string>;

/**
 * Map a Salesforce Contact to app Contact format
 */
export function mapSalesforceToContact(
  sfContact: SalesforceContact,
  accountIdMap: AccountIdMap
): ContactImportData {
  // Look up local account ID from Salesforce Account ID
  const accountId = sfContact.AccountId
    ? accountIdMap.get(sfContact.AccountId) || null
    : null;

  return {
    firstName: sfContact.FirstName || '',
    lastName: sfContact.LastName,
    title: sfContact.Title || null,
    email: sfContact.Email || null,
    phone: sfContact.Phone || null,
    role: 'user' as ContactRole, // Default role since SF doesn't have equivalent
    salesforceId: sfContact.Id,
    salesforceLastSyncAt: new Date(),
    accountId,
  };
}

/**
 * Map an app Contact to Salesforce Contact format
 */
export function mapContactToSalesforce(
  contact: Contact,
  sfAccountIdMap: Map<string, string> // App Account ID → SF Account ID
): Partial<SalesforceContact> {
  const sfContact: Partial<SalesforceContact> = {
    FirstName: contact.firstName || undefined,
    LastName: contact.lastName,
  };

  if (contact.title) {
    sfContact.Title = contact.title;
  }

  if (contact.email) {
    sfContact.Email = contact.email;
  }

  if (contact.phone) {
    sfContact.Phone = contact.phone;
  }

  if (contact.accountId) {
    const sfAccountId = sfAccountIdMap.get(contact.accountId);
    if (sfAccountId) {
      sfContact.AccountId = sfAccountId;
    }
  }

  return sfContact;
}

/**
 * Check if Salesforce contact is newer than local contact
 */
export function isSalesforceContactNewer(
  sfContact: SalesforceContact,
  localContact: { salesforceLastSyncAt: Date | null } | null
): boolean {
  if (!localContact?.salesforceLastSyncAt) {
    return true;
  }

  const sfModified = new Date(sfContact.LastModifiedDate);
  return sfModified > localContact.salesforceLastSyncAt;
}
