/**
 * Gong API V2 Client
 * @see https://gong.app.gong.io/settings/api/documentation
 *
 * Authentication: Basic Auth with Access Key + Access Key Secret
 * Rate Limits: 3 calls/second, 10,000 calls/day
 */

import { getGongRateLimiter } from './rate-limiter';
import type {
  GongCallsRequest,
  GongCallsResponse,
  GongTranscriptsRequest,
  GongTranscriptsResponse,
  GongUsersRequest,
  GongUsersResponse,
  GongCallData,
  GongTranscript,
  GongUser,
} from './types';

export class GongApiClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(accessKey: string, accessKeySecret: string, baseUrl?: string) {
    // Default Gong API URL - check your region at gong.io/settings/api
    this.baseUrl = baseUrl || 'https://api.gong.io/v2';

    // Create Basic Auth header
    const credentials = Buffer.from(`${accessKey}:${accessKeySecret}`).toString('base64');
    this.authHeader = `Basic ${credentials}`;
  }

  // ============================================================================
  // Core API Methods
  // ============================================================================

  /**
   * Test connection by fetching a small number of users
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.request<GongUsersResponse>('/users', {
        method: 'GET',
      });
      return !!response.requestId;
    } catch (error) {
      console.error('Gong connection test failed:', error);
      return false;
    }
  }

  /**
   * List calls within a date range
   * @param fromDateTime ISO datetime string
   * @param toDateTime ISO datetime string
   * @param cursor Optional cursor for pagination
   */
  async listCalls(
    fromDateTime: string,
    toDateTime: string,
    cursor?: string
  ): Promise<GongCallsResponse> {
    const body: GongCallsRequest = {
      fromDateTime,
      toDateTime,
      ...(cursor && { cursor }),
    };

    return this.request<GongCallsResponse>('/calls', {
      method: 'POST',
      body: JSON.stringify({ filter: body }),
    });
  }

  /**
   * Get detailed call data for specific calls
   * @param callIds Array of Gong call IDs (max 100 per request)
   */
  async getCallsExtensive(callIds: string[]): Promise<GongCallsResponse> {
    // Gong limits to 100 calls per request
    if (callIds.length > 100) {
      throw new Error('getCallsExtensive: Maximum 100 call IDs per request');
    }

    return this.request<GongCallsResponse>('/calls/extensive', {
      method: 'POST',
      body: JSON.stringify({
        filter: { callIds },
        contentSelector: {
          exposedFields: {
            parties: true,
            content: true,
            collaboration: true,
            media: true,
          },
        },
      }),
    });
  }

  /**
   * Get transcripts for specific calls
   * @param callIds Array of Gong call IDs (max 100 per request)
   */
  async getTranscripts(callIds: string[]): Promise<GongTranscriptsResponse> {
    if (callIds.length > 100) {
      throw new Error('getTranscripts: Maximum 100 call IDs per request');
    }

    const body: GongTranscriptsRequest = {
      filter: { callIds },
    };

    return this.request<GongTranscriptsResponse>('/calls/transcript', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * List all users in the Gong workspace
   * @param cursor Optional cursor for pagination
   */
  async listUsers(cursor?: string): Promise<GongUsersResponse> {
    const params = new URLSearchParams();
    if (cursor) {
      params.append('cursor', cursor);
    }

    const url = params.toString() ? `/users?${params.toString()}` : '/users';
    return this.request<GongUsersResponse>(url, {
      method: 'GET',
    });
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Fetch all calls within a date range, handling pagination automatically
   * @param fromDateTime ISO datetime string
   * @param toDateTime ISO datetime string
   * @param maxCalls Maximum number of calls to fetch (default: 1000)
   */
  async fetchAllCalls(
    fromDateTime: string,
    toDateTime: string,
    maxCalls: number = 1000
  ): Promise<{ calls: GongCallData[]; hasMore: boolean; nextCursor?: string }> {
    const calls: GongCallData[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore && calls.length < maxCalls) {
      const response = await this.listCalls(fromDateTime, toDateTime, cursor);

      calls.push(...response.calls);

      if (response.records.cursor && calls.length < maxCalls) {
        cursor = response.records.cursor;
      } else {
        hasMore = !!response.records.cursor;
        break;
      }
    }

    return {
      calls: calls.slice(0, maxCalls),
      hasMore: hasMore || calls.length >= maxCalls,
      nextCursor: cursor,
    };
  }

  /**
   * Fetch all users, handling pagination automatically
   */
  async fetchAllUsers(): Promise<GongUser[]> {
    const users: GongUser[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.listUsers(cursor);
      users.push(...response.users);
      cursor = response.records.cursor;
    } while (cursor);

    return users;
  }

  /**
   * Fetch a single call with full details and transcript
   */
  async fetchCallWithTranscript(callId: string): Promise<{
    call: GongCallData | null;
    transcript: GongTranscript | null;
  }> {
    const [callsResponse, transcriptsResponse] = await Promise.all([
      this.getCallsExtensive([callId]),
      this.getTranscripts([callId]),
    ]);

    return {
      call: callsResponse.calls[0] || null,
      transcript: transcriptsResponse.callTranscripts[0] || null,
    };
  }

  /**
   * Fetch transcripts for multiple calls in batches
   * @param callIds Array of call IDs
   * @param batchSize Number of calls per request (max 100)
   */
  async fetchTranscriptsInBatches(
    callIds: string[],
    batchSize: number = 50
  ): Promise<Map<string, GongTranscript>> {
    const transcriptMap = new Map<string, GongTranscript>();

    // Process in batches
    for (let i = 0; i < callIds.length; i += batchSize) {
      const batch = callIds.slice(i, i + batchSize);
      const response = await this.getTranscripts(batch);

      for (const transcript of response.callTranscripts) {
        transcriptMap.set(transcript.callId, transcript);
      }
    }

    return transcriptMap;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const rateLimiter = getGongRateLimiter();
    await rateLimiter.acquire();

    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;

      console.warn(`Gong API rate limited. Waiting ${waitTime}ms before retry.`);
      await this.sleep(waitTime);

      // Retry once
      return this.request<T>(endpoint, options);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new GongApiError(
        `Gong API error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    return response.json() as Promise<T>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Custom error class for Gong API errors
 */
export class GongApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string
  ) {
    super(message);
    this.name = 'GongApiError';
  }
}

/**
 * Create a Gong API client from encrypted credentials
 */
export function createGongClient(
  accessKey: string,
  accessKeySecret: string,
  baseUrl?: string
): GongApiClient {
  return new GongApiClient(accessKey, accessKeySecret, baseUrl);
}
