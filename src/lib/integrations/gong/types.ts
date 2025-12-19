/**
 * Gong API V2 Type Definitions
 * @see https://gong.app.gong.io/settings/api/documentation
 */

// ============================================================================
// Call Types
// ============================================================================

export interface GongParty {
  id: string;
  name: string;
  emailAddress?: string;
  phoneNumber?: string;
  context?: 'Internal' | 'External';
  speakerId?: string;
  affiliation?: string;
}

export interface GongCallData {
  id: string;
  url: string;
  title: string;
  scheduled?: string; // ISO datetime
  started: string; // ISO datetime
  duration: number; // seconds
  direction: 'Inbound' | 'Outbound' | 'Conference';
  scope: string;
  media?: {
    url?: string;
  };
  parties: GongParty[];
  content?: {
    topics?: string[];
    trackers?: Array<{
      name: string;
      count: number;
    }>;
  };
  collaboration?: {
    publicComments?: number;
  };
  language?: string;
  workspaceId?: string;
  meetingUrl?: string;
}

export interface GongCallsResponse {
  requestId: string;
  records: {
    totalRecords: number;
    currentPageSize: number;
    currentPageNumber: number;
    cursor?: string;
  };
  calls: GongCallData[];
}

// ============================================================================
// Transcript Types
// ============================================================================

export interface GongTranscriptSentence {
  start: number; // milliseconds
  end: number; // milliseconds
  text: string;
}

export interface GongTranscriptEntry {
  speakerId: string;
  topic?: string;
  sentences: GongTranscriptSentence[];
}

export interface GongTranscript {
  callId: string;
  transcript: GongTranscriptEntry[];
}

export interface GongTranscriptsResponse {
  requestId: string;
  records: {
    totalRecords: number;
    currentPageSize: number;
    currentPageNumber: number;
    cursor?: string;
  };
  callTranscripts: GongTranscript[];
}

// ============================================================================
// User Types
// ============================================================================

export interface GongUser {
  id: string;
  emailAddress: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  phoneNumber?: string;
  extension?: string;
  active: boolean;
  created: string; // ISO datetime
  settings?: {
    webConferencesRecorded?: boolean;
    preventWebConferencesRecording?: boolean;
    emailsImported?: boolean;
  };
  managerId?: string;
  meetingConsentPageUrl?: string;
}

export interface GongUsersResponse {
  requestId: string;
  records: {
    totalRecords: number;
    currentPageSize: number;
    currentPageNumber: number;
    cursor?: string;
  };
  users: GongUser[];
}

// ============================================================================
// API Request Types
// ============================================================================

export interface GongCallsRequest {
  fromDateTime: string; // ISO datetime
  toDateTime: string; // ISO datetime
  cursor?: string;
  workspaceId?: string;
}

export interface GongTranscriptsRequest {
  filter: {
    callIds: string[];
  };
}

export interface GongUsersRequest {
  cursor?: string;
  includeAvatars?: boolean;
}

// ============================================================================
// Integration Types
// ============================================================================

export interface GongIntegrationStatus {
  connected: boolean;
  lastSyncAt?: Date | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  isEnabled: boolean;
  syncIntervalMinutes: number;
}

export interface GongSyncResult {
  success: boolean;
  callsSynced: number;
  callsSkipped: number;
  errors: string[];
  nextCursor?: string;
}

// ============================================================================
// Matching Types
// ============================================================================

export interface GongCallMatchResult {
  opportunityId: string | null;
  accountId: string | null;
  matchedBy: 'contact_email' | 'account_domain' | 'opportunity_domain' | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface FormattedParticipant {
  name: string;
  email?: string;
  isExternal: boolean;
  speakerId?: string;
}
