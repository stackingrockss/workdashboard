// src/lib/integrations/api-ninjas.ts
// API Ninjas integration for earnings transcripts (S&P 100 companies on free tier)
// API Docs: https://api-ninjas.com/api/earningstranscript

const API_NINJAS_KEY = process.env.API_NINJAS_KEY;
const API_NINJAS_BASE_URL = "https://api.api-ninjas.com/v1";

/**
 * Check if API Ninjas is configured
 */
export function isApiNinjasConfigured(): boolean {
  return !!API_NINJAS_KEY;
}

/**
 * Get Seeking Alpha transcript URL for manual copy/paste
 * Works for any publicly traded company
 */
export function getSeekingAlphaTranscriptUrl(ticker: string): string {
  return `https://seekingalpha.com/symbol/${ticker.toUpperCase()}/earnings/transcripts`;
}

interface ApiNinjasTranscriptResponse {
  ticker: string;
  cik: string;
  year: number;
  quarter: number;
  date: string;
  transcript: string;
}

/**
 * Fetch earnings transcript from API Ninjas
 * Free tier: 10,000 calls/month, S&P 100 companies only
 *
 * @param ticker - Stock ticker symbol (e.g., "AAPL")
 * @param year - Fiscal year (e.g., 2024)
 * @param quarter - Quarter number (1-4)
 * @returns Transcript text or null if not available
 */
export async function fetchEarningsTranscript(
  ticker: string,
  year: number,
  quarter: number
): Promise<string | null> {
  if (!isApiNinjasConfigured()) {
    console.warn("API Ninjas not configured - API_NINJAS_KEY not set");
    return null;
  }

  try {
    const url = new URL(`${API_NINJAS_BASE_URL}/earningstranscript`);
    url.searchParams.set("ticker", ticker.toUpperCase());
    url.searchParams.set("year", year.toString());
    url.searchParams.set("quarter", quarter.toString());

    const response = await fetch(url.toString(), {
      headers: {
        "X-Api-Key": API_NINJAS_KEY!,
      },
    });

    if (response.status === 404) {
      // Transcript not found - likely not an S&P 100 company or quarter not available
      console.log(
        `API Ninjas: Transcript not found for ${ticker} Q${quarter} ${year} (may not be S&P 100)`
      );
      return null;
    }

    if (response.status === 401) {
      console.error("API Ninjas: Invalid API key");
      return null;
    }

    if (response.status === 429) {
      console.error("API Ninjas: Rate limit exceeded");
      return null;
    }

    if (!response.ok) {
      console.error(
        `API Ninjas: HTTP ${response.status} - ${response.statusText}`
      );
      return null;
    }

    const data: ApiNinjasTranscriptResponse = await response.json();

    if (!data.transcript) {
      console.log(`API Ninjas: Empty transcript for ${ticker} Q${quarter} ${year}`);
      return null;
    }

    return data.transcript;
  } catch (error) {
    console.error("API Ninjas fetch error:", error);
    return null;
  }
}

/**
 * Result type for transcript fetch attempts
 */
export interface TranscriptFetchResult {
  success: boolean;
  transcript: string | null;
  source: "api-ninjas" | "manual" | null;
  manualUploadRequired: boolean;
  seekingAlphaUrl: string;
  error?: string;
}

/**
 * Attempt to fetch transcript, returning helpful info for manual fallback
 */
export async function fetchTranscriptWithFallback(
  ticker: string,
  year: number,
  quarter: number
): Promise<TranscriptFetchResult> {
  const seekingAlphaUrl = getSeekingAlphaTranscriptUrl(ticker);

  // Try API Ninjas first
  if (isApiNinjasConfigured()) {
    const transcript = await fetchEarningsTranscript(ticker, year, quarter);

    if (transcript) {
      return {
        success: true,
        transcript,
        source: "api-ninjas",
        manualUploadRequired: false,
        seekingAlphaUrl,
      };
    }
  }

  // API not configured or transcript not available
  return {
    success: false,
    transcript: null,
    source: null,
    manualUploadRequired: true,
    seekingAlphaUrl,
    error: isApiNinjasConfigured()
      ? "Transcript not available via API (may not be S&P 100 company)"
      : "API Ninjas not configured",
  };
}
