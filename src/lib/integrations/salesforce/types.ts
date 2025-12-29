/**
 * Salesforce Integration Types
 */

// Salesforce standard opportunity fields
export interface SalesforceOpportunity {
  Id: string;
  Name: string;
  Amount?: number | null;
  CloseDate: string; // YYYY-MM-DD
  StageName: string;
  Probability?: number | null;
  NextStep?: string | null;
  Description?: string | null;
  AccountId?: string | null;
  OwnerId: string;
  ForecastCategoryName?: string | null;
  LastModifiedDate: string;
  CreatedDate: string;
}

// Salesforce standard account fields
export interface SalesforceAccount {
  Id: string;
  Name: string;
  Website?: string | null;
  Industry?: string | null;
  Description?: string | null;
  OwnerId?: string | null;
  LastModifiedDate: string;
  CreatedDate: string;
}

// Salesforce standard contact fields
export interface SalesforceContact {
  Id: string;
  FirstName?: string | null;
  LastName: string;
  Title?: string | null;
  Email?: string | null;
  Phone?: string | null;
  AccountId?: string | null;
  OwnerId?: string | null;
  LastModifiedDate: string;
  CreatedDate: string;
}

// Salesforce user for owner mapping
export interface SalesforceUser {
  Id: string;
  Email: string;
  Name: string;
  IsActive: boolean;
}

// OAuth response from Salesforce
export interface SalesforceOAuthResponse {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

// Token refresh response (no refresh_token)
export interface SalesforceTokenRefreshResponse {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

// Query response wrapper
export interface SalesforceQueryResponse<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

// Sync direction options
export type SyncDirection = 'import_only' | 'export_only' | 'bidirectional';

// Sync status options
export type SyncStatus = 'success' | 'failed' | 'in_progress';

// Record sync status
export type RecordSyncStatus = 'synced' | 'pending_push' | 'pending_pull' | 'conflict';

// Stage mapping between your app and Salesforce
export const STAGE_MAPPING = {
  // Your app stage -> Salesforce stage name
  toSalesforce: {
    discovery: 'Prospecting',
    demo: 'Needs Analysis',
    validateSolution: 'Proposal/Price Quote',
    decisionMakerApproval: 'Negotiation/Review',
    contracting: 'Negotiation/Review',
    closedWon: 'Closed Won',
    closedLost: 'Closed Lost',
  },
  // Salesforce stage name -> Your app stage
  fromSalesforce: {
    'Prospecting': 'discovery',
    'Qualification': 'discovery',
    'Needs Analysis': 'demo',
    'Value Proposition': 'demo',
    'Id. Decision Makers': 'demo',
    'Perception Analysis': 'validateSolution',
    'Proposal/Price Quote': 'validateSolution',
    'Negotiation/Review': 'decisionMakerApproval',
    'Closed Won': 'closedWon',
    'Closed Lost': 'closedLost',
  },
} as const;

// Confidence level to probability mapping
export const CONFIDENCE_TO_PROBABILITY = {
  1: 10,
  2: 25,
  3: 50,
  4: 75,
  5: 90,
} as const;

// Probability to confidence level mapping
export const PROBABILITY_TO_CONFIDENCE = {
  0: 1,
  10: 1,
  20: 2,
  25: 2,
  30: 2,
  40: 3,
  50: 3,
  60: 4,
  70: 4,
  75: 4,
  80: 5,
  90: 5,
  100: 5,
} as const;

// Helper to convert probability (0-100) to confidence (1-5)
export function probabilityToConfidence(probability: number | null | undefined): number {
  if (probability === null || probability === undefined) {
    return 3; // Default to medium confidence
  }

  // Round to nearest 10
  const rounded = Math.round(probability / 10) * 10;
  const clamped = Math.max(0, Math.min(100, rounded)) as keyof typeof PROBABILITY_TO_CONFIDENCE;

  return PROBABILITY_TO_CONFIDENCE[clamped] || 3;
}

// Helper to convert confidence (1-5) to probability (0-100)
export function confidenceToProbability(confidence: number): number {
  const clamped = Math.max(1, Math.min(5, confidence)) as keyof typeof CONFIDENCE_TO_PROBABILITY;
  return CONFIDENCE_TO_PROBABILITY[clamped];
}
