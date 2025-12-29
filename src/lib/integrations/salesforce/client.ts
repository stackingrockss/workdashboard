/**
 * Salesforce API Client
 *
 * Uses jsforce for OAuth and REST API operations.
 * Handles token refresh automatically.
 */

import jsforce, { Connection, OAuth2, IdentityInfo, DescribeSObjectResult } from 'jsforce';
import { prisma } from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/integrations/oauth-helpers';
import type {
  SalesforceOpportunity,
  SalesforceAccount,
  SalesforceContact,
  SalesforceUser,
} from './types';

// Error type for Salesforce API errors
interface SalesforceErrorLike {
  errorCode?: string;
  message?: string;
}

// Environment variable validation
function getConfig() {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
  const redirectUri = process.env.SALESFORCE_REDIRECT_URI;
  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com';

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Salesforce OAuth credentials not configured. Set SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, and SALESFORCE_REDIRECT_URI environment variables.'
    );
  }

  return { clientId, clientSecret, redirectUri, loginUrl };
}

/**
 * Get OAuth2 configuration for jsforce
 */
export function getOAuth2(): OAuth2 {
  const { clientId, clientSecret, redirectUri, loginUrl } = getConfig();

  return new jsforce.OAuth2({
    clientId,
    clientSecret,
    redirectUri,
    loginUrl,
  });
}

/**
 * Generate the OAuth authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  const oauth2 = getOAuth2();

  return oauth2.getAuthorizationUrl({
    scope: 'api refresh_token offline_access',
    state,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
}> {
  const oauth2 = getOAuth2();
  const conn = new jsforce.Connection({ oauth2 });

  await conn.authorize(code);

  if (!conn.accessToken || !conn.refreshToken || !conn.instanceUrl) {
    throw new Error('Failed to get tokens from Salesforce');
  }

  return {
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    instanceUrl: conn.instanceUrl,
  };
}

/**
 * Refresh an access token using the refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  instanceUrl: string
): Promise<{ accessToken: string }> {
  const { clientId, clientSecret } = getConfig();

  // Use direct HTTP call for token refresh
  const response = await fetch(`${instanceUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Salesforce token refresh failed:', error);
    throw new Error('Failed to refresh Salesforce token');
  }

  const data = await response.json();
  return { accessToken: data.access_token };
}

/**
 * Custom error class for Salesforce API errors
 */
export class SalesforceApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
    public readonly fields?: string[]
  ) {
    super(message);
    this.name = 'SalesforceApiError';
  }
}

/**
 * Salesforce API Client class
 * Wraps jsforce with automatic token refresh and error handling
 */
export class SalesforceClient {
  private connection: Connection;
  private organizationId: string;

  constructor(
    accessToken: string,
    instanceUrl: string,
    refreshToken: string,
    organizationId: string
  ) {
    this.organizationId = organizationId;

    const oauth2 = getOAuth2();

    this.connection = new jsforce.Connection({
      oauth2,
      accessToken,
      refreshToken,
      instanceUrl,
    });

    // Handle automatic token refresh
    this.connection.on('refresh', async (newAccessToken: string) => {
      try {
        await this.saveRefreshedToken(newAccessToken);
      } catch (error) {
        console.error('Failed to save refreshed Salesforce token:', error);
      }
    });
  }

  /**
   * Save refreshed token to database
   */
  private async saveRefreshedToken(newAccessToken: string): Promise<void> {
    await prisma.salesforceIntegration.update({
      where: { organizationId: this.organizationId },
      data: {
        accessToken: encryptToken(newAccessToken),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Test connection by querying current user
   */
  async testConnection(): Promise<boolean> {
    try {
      const identity = await this.connection.identity();
      return !!identity.user_id;
    } catch (error) {
      console.error('Salesforce connection test failed:', error);
      return false;
    }
  }

  /**
   * Get current user identity
   */
  async getIdentity(): Promise<IdentityInfo> {
    return this.connection.identity();
  }

  // ============================================================================
  // Opportunity Operations
  // ============================================================================

  /**
   * Query opportunities with optional filters
   */
  async queryOpportunities(options?: {
    modifiedSince?: Date;
    limit?: number;
  }): Promise<SalesforceOpportunity[]> {
    let query = `
      SELECT Id, Name, Amount, CloseDate, StageName, Probability, NextStep,
             Description, AccountId, OwnerId, ForecastCategoryName,
             LastModifiedDate, CreatedDate
      FROM Opportunity
    `;

    const conditions: string[] = [];

    if (options?.modifiedSince) {
      conditions.push(`LastModifiedDate >= ${options.modifiedSince.toISOString()}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY LastModifiedDate DESC';

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await this.connection.query<SalesforceOpportunity>(query);
    return result.records;
  }

  /**
   * Get a single opportunity by ID
   */
  async getOpportunity(id: string): Promise<SalesforceOpportunity | null> {
    try {
      const result = await this.connection.sobject('Opportunity').retrieve(id);
      return result as unknown as SalesforceOpportunity;
    } catch (error) {
      if ((error as { errorCode?: string }).errorCode === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create an opportunity in Salesforce
   */
  async createOpportunity(data: Partial<SalesforceOpportunity>): Promise<string> {
    const result = await this.connection.sobject('Opportunity').create(data);

    if (!result.success) {
      const errors = result.errors?.map((e: SalesforceErrorLike) => e.message).join(', ') || 'Unknown error';
      throw new SalesforceApiError(`Failed to create opportunity: ${errors}`);
    }

    return result.id;
  }

  /**
   * Update an opportunity in Salesforce
   */
  async updateOpportunity(id: string, data: Partial<SalesforceOpportunity>): Promise<void> {
    const result = await this.connection.sobject('Opportunity').update({ Id: id, ...data });

    if (!result.success) {
      const errors = result.errors?.map((e: SalesforceErrorLike) => e.message).join(', ') || 'Unknown error';
      throw new SalesforceApiError(`Failed to update opportunity: ${errors}`);
    }
  }

  // ============================================================================
  // Account Operations
  // ============================================================================

  /**
   * Query accounts with optional filters
   */
  async queryAccounts(options?: {
    modifiedSince?: Date;
    limit?: number;
  }): Promise<SalesforceAccount[]> {
    let query = `
      SELECT Id, Name, Website, Industry, Description, OwnerId,
             LastModifiedDate, CreatedDate
      FROM Account
    `;

    const conditions: string[] = [];

    if (options?.modifiedSince) {
      conditions.push(`LastModifiedDate >= ${options.modifiedSince.toISOString()}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY LastModifiedDate DESC';

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await this.connection.query<SalesforceAccount>(query);
    return result.records;
  }

  /**
   * Get a single account by ID
   */
  async getAccount(id: string): Promise<SalesforceAccount | null> {
    try {
      const result = await this.connection.sobject('Account').retrieve(id);
      return result as unknown as SalesforceAccount;
    } catch (error) {
      if ((error as { errorCode?: string }).errorCode === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create an account in Salesforce
   */
  async createAccount(data: Partial<SalesforceAccount>): Promise<string> {
    const result = await this.connection.sobject('Account').create(data);

    if (!result.success) {
      const errors = result.errors?.map((e: SalesforceErrorLike) => e.message).join(', ') || 'Unknown error';
      throw new SalesforceApiError(`Failed to create account: ${errors}`);
    }

    return result.id;
  }

  /**
   * Update an account in Salesforce
   */
  async updateAccount(id: string, data: Partial<SalesforceAccount>): Promise<void> {
    const result = await this.connection.sobject('Account').update({ Id: id, ...data });

    if (!result.success) {
      const errors = result.errors?.map((e: SalesforceErrorLike) => e.message).join(', ') || 'Unknown error';
      throw new SalesforceApiError(`Failed to update account: ${errors}`);
    }
  }

  // ============================================================================
  // Contact Operations
  // ============================================================================

  /**
   * Query contacts with optional filters
   */
  async queryContacts(options?: {
    modifiedSince?: Date;
    accountId?: string;
    limit?: number;
  }): Promise<SalesforceContact[]> {
    let query = `
      SELECT Id, FirstName, LastName, Title, Email, Phone, AccountId, OwnerId,
             LastModifiedDate, CreatedDate
      FROM Contact
    `;

    const conditions: string[] = [];

    if (options?.modifiedSince) {
      conditions.push(`LastModifiedDate >= ${options.modifiedSince.toISOString()}`);
    }

    if (options?.accountId) {
      conditions.push(`AccountId = '${options.accountId}'`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY LastModifiedDate DESC';

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const result = await this.connection.query<SalesforceContact>(query);
    return result.records;
  }

  /**
   * Get a single contact by ID
   */
  async getContact(id: string): Promise<SalesforceContact | null> {
    try {
      const result = await this.connection.sobject('Contact').retrieve(id);
      return result as unknown as SalesforceContact;
    } catch (error) {
      if ((error as { errorCode?: string }).errorCode === 'NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a contact in Salesforce
   */
  async createContact(data: Partial<SalesforceContact>): Promise<string> {
    const result = await this.connection.sobject('Contact').create(data);

    if (!result.success) {
      const errors = result.errors?.map((e: SalesforceErrorLike) => e.message).join(', ') || 'Unknown error';
      throw new SalesforceApiError(`Failed to create contact: ${errors}`);
    }

    return result.id;
  }

  /**
   * Update a contact in Salesforce
   */
  async updateContact(id: string, data: Partial<SalesforceContact>): Promise<void> {
    const result = await this.connection.sobject('Contact').update({ Id: id, ...data });

    if (!result.success) {
      const errors = result.errors?.map((e: SalesforceErrorLike) => e.message).join(', ') || 'Unknown error';
      throw new SalesforceApiError(`Failed to update contact: ${errors}`);
    }
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  /**
   * Query all active users
   */
  async queryUsers(): Promise<SalesforceUser[]> {
    const query = `
      SELECT Id, Email, Name, IsActive
      FROM User
      WHERE IsActive = true
      ORDER BY Name
    `;

    const result = await this.connection.query<SalesforceUser>(query);
    return result.records;
  }

  /**
   * Find a user by email
   */
  async findUserByEmail(email: string): Promise<SalesforceUser | null> {
    const query = `
      SELECT Id, Email, Name, IsActive
      FROM User
      WHERE Email = '${email}'
      LIMIT 1
    `;

    const result = await this.connection.query<SalesforceUser>(query);
    return result.records[0] || null;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get available stage values (picklist)
   */
  async getOpportunityStages(): Promise<string[]> {
    const describe: DescribeSObjectResult = await this.connection.sobject('Opportunity').describe();
    const stageField = describe.fields.find((f: { name: string }) => f.name === 'StageName');

    if (!stageField?.picklistValues) {
      return [];
    }

    return stageField.picklistValues
      .filter((v: { active: boolean; value: string }) => v.active)
      .map((v: { active: boolean; value: string }) => v.value);
  }

  /**
   * Get organization limits and usage
   */
  async getLimits(): Promise<Record<string, { Max: number; Remaining: number }>> {
    const limits = await this.connection.limits();
    return limits;
  }
}

/**
 * Create a Salesforce client from stored integration
 */
export async function createSalesforceClient(
  organizationId: string
): Promise<SalesforceClient | null> {
  const integration = await prisma.salesforceIntegration.findUnique({
    where: { organizationId },
  });

  if (!integration || !integration.isEnabled) {
    return null;
  }

  try {
    const accessToken = decryptToken(integration.accessToken);
    const refreshToken = decryptToken(integration.refreshToken);

    return new SalesforceClient(
      accessToken,
      integration.instanceUrl,
      refreshToken,
      organizationId
    );
  } catch (error) {
    console.error('Failed to create Salesforce client:', error);
    return null;
  }
}

/**
 * Revoke Salesforce OAuth tokens
 */
export async function revokeSalesforceTokens(
  accessToken: string,
  instanceUrl: string
): Promise<void> {
  try {
    await fetch(`${instanceUrl}/services/oauth2/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: accessToken }),
    });
  } catch (error) {
    console.error('Failed to revoke Salesforce token:', error);
    // Don't throw - we'll delete from DB anyway
  }
}
