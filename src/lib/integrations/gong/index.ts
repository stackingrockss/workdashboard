/**
 * Gong API Integration Module
 *
 * This module provides integration with Gong's API V2 for:
 * - Fetching call recordings and metadata
 * - Retrieving call transcripts
 * - Managing users and sync state
 */

// Client
export { GongApiClient, GongApiError, createGongClient } from './client';

// Types
export type {
  GongCallData,
  GongParty,
  GongTranscript,
  GongTranscriptEntry,
  GongTranscriptSentence,
  GongUser,
  GongCallsResponse,
  GongTranscriptsResponse,
  GongUsersResponse,
  GongCallsRequest,
  GongTranscriptsRequest,
  GongUsersRequest,
  GongIntegrationStatus,
  GongSyncResult,
  GongCallMatchResult,
  FormattedParticipant,
} from './types';

// Rate Limiter
export {
  RateLimiter,
  getGongRateLimiter,
  resetGongRateLimiter,
} from './rate-limiter';

// Transcript Formatter
export {
  formatGongTranscript,
  formatGongTranscriptDetailed,
  extractTranscriptText,
  getTranscriptStats,
} from './transcript-formatter';

// Matching
export {
  extractExternalEmails,
  extractDomain,
  matchCallToOpportunity,
  findMatchingCalendarEvent,
  getPrimaryExternalEmail,
} from './matching';
