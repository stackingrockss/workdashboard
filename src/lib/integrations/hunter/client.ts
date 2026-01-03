/**
 * Hunter.io API Client
 *
 * Provides contact enrichment via Hunter.io's Combined Enrichment API.
 * Implements the EnrichmentProvider interface for easy swapping.
 *
 * API Docs: https://hunter.io/api/combined-enrichment
 * Rate Limits: 30 requests/minute on paid plans
 */

import {
  EnrichmentProvider,
  EnrichmentResult,
  EnrichedContactData,
} from "@/lib/integrations/enrichment/types";
import { getHunterRateLimiter } from "./rate-limiter";

// Hunter.io API response types
interface HunterPersonData {
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  twitter?: string;
  linkedin_url?: string;
  phone_number?: string;
  company?: string;
  seniority?: string; // "executive", "senior", "junior"
  department?: string;
}

interface HunterCompanyData {
  name?: string;
  domain?: string;
  industry?: string;
  size?: string;
  linkedin_url?: string;
  twitter?: string;
  facebook?: string;
}

interface HunterEnrichmentResponse {
  data: {
    person?: HunterPersonData;
    company?: HunterCompanyData;
  };
  meta: {
    params: {
      email: string;
    };
  };
}

interface HunterErrorResponse {
  errors: Array<{
    id: string;
    code: number;
    details: string;
  }>;
}

export class HunterClient implements EnrichmentProvider {
  public readonly name = "hunter";
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.hunter.io/v2";

  constructor(apiKey?: string) {
    const key = apiKey || process.env.HUNTER_API_KEY;
    if (!key) {
      throw new Error("Hunter API key is required. Set HUNTER_API_KEY environment variable.");
    }
    this.apiKey = key;
  }

  /**
   * Enrich a person by email using Hunter's Combined Enrichment API
   */
  async enrichPerson(email: string): Promise<EnrichmentResult> {
    const rateLimiter = getHunterRateLimiter();
    await rateLimiter.acquire();

    try {
      const url = new URL(`${this.baseUrl}/combined-enrichment`);
      url.searchParams.set("email", email);
      url.searchParams.set("api_key", this.apiKey);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        console.warn("[Hunter] Rate limited, waiting before retry...");
        await this.sleep(2000);
        return this.enrichPerson(email); // Retry once
      }

      // Handle no credits
      if (response.status === 402) {
        return {
          success: false,
          error: "Hunter API credits exhausted",
          creditsUsed: 0,
        };
      }

      // Handle not found (404 or empty data)
      if (response.status === 404) {
        return {
          success: false,
          error: "Person not found",
          creditsUsed: 1, // Hunter charges for lookups even when not found
        };
      }

      if (!response.ok) {
        const errorData = (await response.json()) as HunterErrorResponse;
        const errorMessage = errorData.errors?.[0]?.details || `HTTP ${response.status}`;
        return {
          success: false,
          error: errorMessage,
          creditsUsed: 0,
        };
      }

      const result = (await response.json()) as HunterEnrichmentResponse;

      // Check if we got any person data
      if (!result.data?.person) {
        return {
          success: false,
          error: "No person data returned",
          creditsUsed: 1,
        };
      }

      // Transform Hunter response to our format
      const enrichedData = this.transformHunterData(result.data.person, result.data.company);

      return {
        success: true,
        data: enrichedData,
        creditsUsed: 1, // Hunter uses 0.2 credit per call, we round to 1 for simplicity
      };
    } catch (error) {
      console.error("[Hunter] Enrichment error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        creditsUsed: 0,
      };
    }
  }

  /**
   * Enrich multiple people by email
   * Hunter doesn't have a batch API, so we process sequentially with rate limiting
   */
  async enrichBatch(emails: string[]): Promise<Map<string, EnrichmentResult>> {
    const results = new Map<string, EnrichmentResult>();

    for (const email of emails) {
      const result = await this.enrichPerson(email);
      results.set(email, result);
    }

    return results;
  }

  /**
   * Test if the API key is valid
   */
  async testConnection(): Promise<boolean> {
    try {
      const url = new URL(`${this.baseUrl}/account`);
      url.searchParams.set("api_key", this.apiKey);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Transform Hunter API response to our standardized format
   */
  private transformHunterData(
    person: HunterPersonData,
    company?: HunterCompanyData
  ): EnrichedContactData {
    // Map Hunter seniority to our format
    const seniorityMap: Record<string, string> = {
      executive: "executive",
      senior: "senior",
      junior: "entry",
    };

    return {
      email: person.email,
      firstName: person.first_name || undefined,
      lastName: person.last_name || undefined,
      fullName: person.full_name || undefined,
      title: person.position || undefined,
      company: person.company || company?.name || undefined,
      seniority: person.seniority ? seniorityMap[person.seniority] || person.seniority : undefined,
      linkedinUrl: person.linkedin_url || undefined,
      twitterUrl: person.twitter ? `https://twitter.com/${person.twitter}` : undefined,
      phone: person.phone_number || undefined,
      // Hunter doesn't provide bio or avatar, these would come from other providers
      bio: undefined,
      avatarUrl: undefined,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a Hunter client instance
 * Uses environment variable for API key if not provided
 */
export function createHunterClient(apiKey?: string): HunterClient {
  return new HunterClient(apiKey);
}
