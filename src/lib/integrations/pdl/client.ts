/**
 * People Data Labs API Client
 *
 * Provides contact enrichment via PDL's Person Enrichment API.
 * Implements the EnrichmentProvider interface for easy swapping.
 *
 * API Docs: https://docs.peopledatalabs.com/docs/person-enrichment-api
 * Rate Limits: 100/min (free), 1000/min (paid)
 */

import {
  EnrichmentProvider,
  EnrichmentResult,
  EnrichedContactData,
} from "@/lib/integrations/enrichment/types";
import { getPdlRateLimiter } from "./rate-limiter";

// PDL API response types
interface PDLPersonData {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  sex?: string;
  birth_year?: number;
  job_title?: string;
  job_title_role?: string;
  job_title_sub_role?: string;
  job_title_levels?: string[];
  job_company_name?: string;
  job_company_size?: string;
  job_company_industry?: string;
  industry?: string;
  linkedin_url?: string;
  linkedin_username?: string;
  twitter_url?: string;
  github_url?: string;
  facebook_url?: string;
  personal_emails?: string[];
  work_email?: string;
  recommended_personal_email?: string;
  mobile_phone?: string;
  phone_numbers?: Array<{
    number: string;
    first_seen?: string;
    last_seen?: string;
  }>;
  location_name?: string;
  location_locality?: string;
  location_region?: string;
  location_country?: string;
  location_postal_code?: string;
  inferred_salary?: string;
  inferred_years_experience?: number;
  summary?: string;
}

interface PDLEnrichmentResponse {
  status: number;
  likelihood: number;
  data: PDLPersonData;
  matched?: string[];
}

interface PDLErrorResponse {
  status: number;
  error?: {
    type: string;
    message: string;
  };
}

export class PDLClient implements EnrichmentProvider {
  public readonly name = "pdl";
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.peopledatalabs.com/v5";

  constructor(apiKey?: string) {
    const key = apiKey || process.env.PDL_API_KEY;
    if (!key) {
      throw new Error("PDL API key is required. Set PDL_API_KEY environment variable.");
    }
    this.apiKey = key;
  }

  /**
   * Enrich a person by email using PDL's Person Enrichment API
   */
  async enrichPerson(email: string): Promise<EnrichmentResult> {
    const rateLimiter = getPdlRateLimiter();
    await rateLimiter.acquire();

    try {
      const url = new URL(`${this.baseUrl}/person/enrich`);
      url.searchParams.set("email", email);
      url.searchParams.set("min_likelihood", "5"); // Only return high-confidence matches
      url.searchParams.set("titlecase", "true"); // Return proper case names

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Api-Key": this.apiKey,
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        console.warn("[PDL] Rate limited, waiting before retry...");
        await this.sleep(2000);
        return this.enrichPerson(email); // Retry once
      }

      // Handle not found (404)
      if (response.status === 404) {
        return {
          success: false,
          error: "Person not found",
          creditsUsed: 0, // PDL only charges for successful matches
        };
      }

      // Handle payment required / credits exhausted
      if (response.status === 402) {
        return {
          success: false,
          error: "PDL API credits exhausted",
          creditsUsed: 0,
        };
      }

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: "PDL API authentication failed",
          creditsUsed: 0,
        };
      }

      if (!response.ok) {
        const errorData = (await response.json()) as PDLErrorResponse;
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        return {
          success: false,
          error: errorMessage,
          creditsUsed: 0,
        };
      }

      const result = (await response.json()) as PDLEnrichmentResponse;

      // Check if we got any person data
      if (!result.data) {
        return {
          success: false,
          error: "No person data returned",
          creditsUsed: 0,
        };
      }

      // Transform PDL response to our format
      const enrichedData = this.transformPDLData(result.data);

      return {
        success: true,
        data: enrichedData,
        creditsUsed: 1,
      };
    } catch (error) {
      console.error("[PDL] Enrichment error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        creditsUsed: 0,
      };
    }
  }

  /**
   * Enrich multiple people by email
   * PDL has a bulk API but we process sequentially for simplicity
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
      // PDL doesn't have an account endpoint, so we test with a known email
      // Using a minimal request to check auth
      const url = new URL(`${this.baseUrl}/person/enrich`);
      url.searchParams.set("email", "test@example.com");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Api-Key": this.apiKey,
        },
      });

      // 401/403 = bad auth, 404 = not found (but auth worked), 200 = found
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  }

  /**
   * Transform PDL API response to our standardized format
   */
  private transformPDLData(person: PDLPersonData): EnrichedContactData {
    // Map PDL job_title_levels to our seniority format
    const seniorityFromLevels = (levels?: string[]): string | undefined => {
      if (!levels || levels.length === 0) return undefined;

      // PDL levels: cxo, director, vp, manager, senior, entry, training, unpaid
      const level = levels[0]?.toLowerCase();
      const seniorityMap: Record<string, string> = {
        cxo: "executive",
        vp: "executive",
        director: "director",
        manager: "manager",
        senior: "senior",
        entry: "entry",
        training: "entry",
      };
      return seniorityMap[level] || level;
    };

    // Get best phone number
    const phone = person.mobile_phone || person.phone_numbers?.[0]?.number;

    return {
      email: person.work_email || person.recommended_personal_email || person.personal_emails?.[0] || "",
      firstName: person.first_name || undefined,
      lastName: person.last_name || undefined,
      fullName: person.full_name || undefined,
      title: person.job_title || undefined,
      company: person.job_company_name || undefined,
      seniority: seniorityFromLevels(person.job_title_levels),
      linkedinUrl: person.linkedin_url || undefined,
      twitterUrl: person.twitter_url || undefined,
      githubUrl: person.github_url || undefined,
      phone: phone || undefined,
      bio: person.summary || undefined,
      avatarUrl: undefined, // PDL doesn't provide avatars
      location: person.location_name
        ? {
            city: person.location_locality || undefined,
            state: person.location_region || undefined,
            country: person.location_country || undefined,
          }
        : undefined,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a PDL client instance
 * Uses environment variable for API key if not provided
 */
export function createPDLClient(apiKey?: string): PDLClient {
  return new PDLClient(apiKey);
}
