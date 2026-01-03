/**
 * Enrichment Provider Interface
 *
 * Abstraction layer for contact enrichment providers (Hunter.io, People Data Labs, etc.)
 * This allows swapping providers without changing the enrichment service logic.
 */

export interface EnrichedContactData {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  company?: string;
  seniority?: string; // "executive", "director", "manager", "senior", "entry"
  linkedinUrl?: string;
  bio?: string;
  avatarUrl?: string;
  phone?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  // Social profiles
  twitterUrl?: string;
  githubUrl?: string;
}

export interface EnrichmentResult {
  success: boolean;
  data?: EnrichedContactData;
  error?: string;
  creditsUsed: number;
}

export interface EnrichmentProvider {
  /** Provider name for logging and tracking */
  name: string;

  /**
   * Enrich a single person by email
   * Returns null if no data found (not an error)
   */
  enrichPerson(email: string): Promise<EnrichmentResult>;

  /**
   * Enrich multiple people by email (optional batch support)
   * Falls back to sequential calls if not implemented
   */
  enrichBatch?(emails: string[]): Promise<Map<string, EnrichmentResult>>;

  /**
   * Test if the provider is configured and working
   */
  testConnection?(): Promise<boolean>;
}

export type EnrichmentProviderType = "hunter" | "pdl" | "manual";

/**
 * Configuration for enrichment behavior
 */
export interface EnrichmentConfig {
  /** Which provider to use */
  provider: EnrichmentProviderType;
  /** Skip enrichment for emails from these domains */
  skipDomains?: string[];
  /** Maximum credits to use per batch operation */
  maxCreditsPerBatch?: number;
  /** Re-enrich contacts older than this many days */
  reEnrichAfterDays?: number;
}
