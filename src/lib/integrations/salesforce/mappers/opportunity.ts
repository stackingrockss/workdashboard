/**
 * Salesforce Opportunity Mapper
 *
 * Maps between Salesforce Opportunity and app Opportunity
 */

import type { Opportunity, OpportunityStage, ForecastCategory } from '@prisma/client';
import type { SalesforceOpportunity } from '../types';
import {
  STAGE_MAPPING,
  probabilityToConfidence,
  confidenceToProbability,
} from '../types';
import type { UserIdMap } from './user';
import { getAppOwnerId, getSalesforceOwnerId } from './user';
import type { AccountIdMap } from './contact';

/**
 * Input type for creating/updating an Opportunity from Salesforce
 */
export interface OpportunityImportData {
  name: string;
  amountArr: number;
  closeDate: Date | null;
  stage: OpportunityStage;
  confidenceLevel: number;
  nextStep: string | null;
  notes: string | null;
  forecastCategory: ForecastCategory | null;
  salesforceId: string;
  salesforceLastSyncAt: Date;
  salesforceLastModified: Date;
  salesforceSyncStatus: string;
  ownerId: string;
  accountId: string | null;
  organizationId: string;
}

/**
 * Map Salesforce stage name to app OpportunityStage
 * Falls back to 'discovery' for unknown stages
 */
export function mapSalesforceStage(sfStageName: string): OpportunityStage {
  const mapping = STAGE_MAPPING.fromSalesforce as Record<string, string>;
  const appStage = mapping[sfStageName];

  if (appStage) {
    return appStage as OpportunityStage;
  }

  // Check for partial matches
  const stageLower = sfStageName.toLowerCase();
  if (stageLower.includes('closed') && stageLower.includes('won')) {
    return 'closedWon';
  }
  if (stageLower.includes('closed') && stageLower.includes('lost')) {
    return 'closedLost';
  }
  if (stageLower.includes('negotiat') || stageLower.includes('contract')) {
    return 'contracting';
  }
  if (stageLower.includes('proposal') || stageLower.includes('quote')) {
    return 'validateSolution';
  }
  if (stageLower.includes('demo') || stageLower.includes('analysis')) {
    return 'demo';
  }

  // Default fallback
  return 'discovery';
}

/**
 * Map app OpportunityStage to Salesforce stage name
 */
export function mapAppStage(appStage: OpportunityStage): string {
  const mapping = STAGE_MAPPING.toSalesforce as Record<string, string>;
  return mapping[appStage] || 'Prospecting';
}

/**
 * Map Salesforce ForecastCategoryName to app ForecastCategory
 */
export function mapSalesforceForecastCategory(
  sfCategory: string | null | undefined
): ForecastCategory | null {
  if (!sfCategory) return null;

  const categoryLower = sfCategory.toLowerCase();

  if (categoryLower.includes('closed') && categoryLower.includes('won')) {
    return 'closedWon';
  }
  if (categoryLower.includes('closed') && categoryLower.includes('lost')) {
    return 'closedLost';
  }
  if (categoryLower.includes('closed')) {
    return 'closedWon'; // Default closed to won
  }
  if (categoryLower.includes('commit')) {
    return 'commit';
  }
  if (categoryLower.includes('best case') || categoryLower.includes('upside')) {
    return 'bestCase';
  }
  if (categoryLower.includes('pipeline') || categoryLower.includes('omitted')) {
    return 'pipeline';
  }

  return null;
}

/**
 * Map app ForecastCategory to Salesforce ForecastCategoryName
 */
export function mapAppForecastCategory(
  appCategory: ForecastCategory | null
): string | undefined {
  if (!appCategory) return undefined;

  switch (appCategory) {
    case 'closedWon':
      return 'Closed';
    case 'closedLost':
      return 'Omitted';
    case 'commit':
      return 'Commit';
    case 'bestCase':
      return 'Best Case';
    case 'pipeline':
      return 'Pipeline';
    default:
      return undefined;
  }
}

/**
 * Convert Salesforce Amount (dollars) to app amountArr (cents)
 */
export function convertAmountToCents(amount: number | null | undefined): number {
  if (amount === null || amount === undefined) {
    return 0;
  }
  return Math.round(amount * 100);
}

/**
 * Convert app amountArr (cents) to Salesforce Amount (dollars)
 */
export function convertCentsToAmount(cents: number): number {
  return cents / 100;
}

/**
 * Map a Salesforce Opportunity to app Opportunity format
 */
export function mapSalesforceToOpportunity(
  sfOpp: SalesforceOpportunity,
  organizationId: string,
  userIdMap: UserIdMap,
  accountIdMap: AccountIdMap
): OpportunityImportData {
  // Look up local account ID from Salesforce Account ID
  const accountId = sfOpp.AccountId
    ? accountIdMap.get(sfOpp.AccountId) || null
    : null;

  return {
    name: sfOpp.Name,
    amountArr: convertAmountToCents(sfOpp.Amount),
    closeDate: sfOpp.CloseDate ? new Date(sfOpp.CloseDate) : null,
    stage: mapSalesforceStage(sfOpp.StageName),
    confidenceLevel: probabilityToConfidence(sfOpp.Probability),
    nextStep: sfOpp.NextStep || null,
    notes: sfOpp.Description || null,
    forecastCategory: mapSalesforceForecastCategory(sfOpp.ForecastCategoryName),
    salesforceId: sfOpp.Id,
    salesforceLastSyncAt: new Date(),
    salesforceLastModified: new Date(sfOpp.LastModifiedDate),
    salesforceSyncStatus: 'synced',
    ownerId: getAppOwnerId(sfOpp.OwnerId, userIdMap),
    accountId,
    organizationId,
  };
}

/**
 * Map an app Opportunity to Salesforce Opportunity format
 */
export function mapOpportunityToSalesforce(
  opp: Opportunity,
  userIdMap: UserIdMap,
  sfAccountIdMap: Map<string, string> // App Account ID → SF Account ID
): Partial<SalesforceOpportunity> {
  const sfOpp: Partial<SalesforceOpportunity> = {
    Name: opp.name,
    Amount: convertCentsToAmount(opp.amountArr),
    StageName: mapAppStage(opp.stage),
    Probability: confidenceToProbability(opp.confidenceLevel),
  };

  if (opp.closeDate) {
    // Format as YYYY-MM-DD for Salesforce
    sfOpp.CloseDate = opp.closeDate.toISOString().split('T')[0];
  }

  if (opp.nextStep) {
    sfOpp.NextStep = opp.nextStep;
  }

  if (opp.notes) {
    sfOpp.Description = opp.notes;
  }

  if (opp.forecastCategory) {
    const sfCategory = mapAppForecastCategory(opp.forecastCategory);
    if (sfCategory) {
      sfOpp.ForecastCategoryName = sfCategory;
    }
  }

  // Map owner
  const sfOwnerId = getSalesforceOwnerId(opp.ownerId, userIdMap);
  if (sfOwnerId) {
    sfOpp.OwnerId = sfOwnerId;
  }

  // Map account
  if (opp.accountId) {
    const sfAccountId = sfAccountIdMap.get(opp.accountId);
    if (sfAccountId) {
      sfOpp.AccountId = sfAccountId;
    }
  }

  return sfOpp;
}

/**
 * Check if Salesforce opportunity is newer than local opportunity
 */
export function isSalesforceOpportunityNewer(
  sfOpp: SalesforceOpportunity,
  localOpp: { salesforceLastModified: Date | null } | null
): boolean {
  if (!localOpp?.salesforceLastModified) {
    return true;
  }

  const sfModified = new Date(sfOpp.LastModifiedDate);
  return sfModified > localOpp.salesforceLastModified;
}
