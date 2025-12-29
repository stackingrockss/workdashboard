/**
 * Salesforce User Mapper
 *
 * Maps Salesforce users to app users via email matching
 */

import { prisma } from '@/lib/db';
import type { SalesforceClient } from '../client';

export interface UserIdMap {
  // Salesforce User ID → App User ID
  sfToApp: Map<string, string>;
  // App User ID → Salesforce User ID
  appToSf: Map<string, string>;
  // Default owner ID (first admin in org) for unmapped users
  defaultOwnerId: string;
}

/**
 * Build a mapping between Salesforce users and app users
 * Matches users by email address
 */
export async function buildUserIdMap(
  client: SalesforceClient,
  organizationId: string
): Promise<UserIdMap> {
  // Fetch all Salesforce users
  const sfUsers = await client.queryUsers();

  // Fetch all app users in the organization
  const appUsers = await prisma.user.findMany({
    where: { organizationId },
    select: { id: true, email: true, role: true, salesforceUserId: true },
  });

  // Build email → app user map
  const emailToAppUser = new Map<string, { id: string; role: string }>();
  for (const user of appUsers) {
    emailToAppUser.set(user.email.toLowerCase(), { id: user.id, role: user.role });
  }

  // Find default owner (first admin, or first user)
  const defaultOwner =
    appUsers.find((u) => u.role === 'ADMIN') ||
    appUsers.find((u) => u.role === 'MANAGER') ||
    appUsers[0];

  if (!defaultOwner) {
    throw new Error('No users found in organization for owner assignment');
  }

  // Build the ID maps
  const sfToApp = new Map<string, string>();
  const appToSf = new Map<string, string>();
  const usersToUpdate: Array<{ id: string; salesforceUserId: string }> = [];

  for (const sfUser of sfUsers) {
    const appUser = emailToAppUser.get(sfUser.Email.toLowerCase());
    if (appUser) {
      sfToApp.set(sfUser.Id, appUser.id);
      appToSf.set(appUser.id, sfUser.Id);

      // Track users that need their salesforceUserId updated
      const existingAppUser = appUsers.find((u) => u.id === appUser.id);
      if (existingAppUser && existingAppUser.salesforceUserId !== sfUser.Id) {
        usersToUpdate.push({ id: appUser.id, salesforceUserId: sfUser.Id });
      }
    }
  }

  // Update app users with their Salesforce IDs (batch update)
  if (usersToUpdate.length > 0) {
    await Promise.all(
      usersToUpdate.map((u) =>
        prisma.user.update({
          where: { id: u.id },
          data: { salesforceUserId: u.salesforceUserId },
        })
      )
    );
  }

  return {
    sfToApp,
    appToSf,
    defaultOwnerId: defaultOwner.id,
  };
}

/**
 * Get app user ID from Salesforce owner ID
 * Falls back to default owner if not found
 */
export function getAppOwnerId(sfOwnerId: string, userIdMap: UserIdMap): string {
  return userIdMap.sfToApp.get(sfOwnerId) || userIdMap.defaultOwnerId;
}

/**
 * Get Salesforce user ID from app owner ID
 * Returns undefined if not found
 */
export function getSalesforceOwnerId(
  appOwnerId: string,
  userIdMap: UserIdMap
): string | undefined {
  return userIdMap.appToSf.get(appOwnerId);
}
