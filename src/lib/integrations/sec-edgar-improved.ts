import * as cheerio from "cheerio";
import { prisma } from "@/lib/db";

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT || "SalesTracker admin@example.com";
const SEC_BASE_URL = "https://www.sec.gov";
const SEC_DATA_URL = "https://www.sec.gov";

/**
 * Rate limiter for SEC EDGAR API (10 requests/second limit)
 */
class RateLimiter {
  private queue: Array<() => void> = [];
  private isProcessing = false;
  private readonly intervalMs = 100; // 10 req/sec = 100ms between requests

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
      }
    }

    this.isProcessing = false;
  }
}

const rateLimiter = new RateLimiter();

interface CompanyTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

interface CompanyTickersData {
  [key: string]: CompanyTickerEntry;
}

export interface CompanyMatch {
  cik: string;
  ticker: string;
  name: string;
}

/**
 * Retry logic with exponential backoff
 */
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt + 1} failed:`, lastError.message);

      // Don't retry on client errors (4xx)
      if (error instanceof Error && error.message.includes("4")) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Check if database cache needs refresh (older than 24 hours)
 */
async function shouldRefreshCache(): Promise<boolean> {
  try {
    const count = await prisma.secCompanyCache.count();
    if (count === 0) return true;

    // Check oldest record
    const oldestRecord = await prisma.secCompanyCache.findFirst({
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true },
    });

    if (!oldestRecord) return true;

    const ageHours =
      (Date.now() - oldestRecord.updatedAt.getTime()) / (1000 * 60 * 60);
    return ageHours > 24;
  } catch (error) {
    console.error("Error checking cache freshness:", error);
    return true; // Refresh on error
  }
}

/**
 * Fetch and cache company tickers data in database
 */
async function refreshSecCompanyCache(): Promise<void> {
  console.log("Refreshing SEC company cache from API...");

  const response = await fetchWithRetry(
    async () => {
      const res = await fetch(`${SEC_DATA_URL}/files/company_tickers.json`, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unable to read error");
        console.error(`SEC API error: ${res.status} - ${errorText}`);
        throw new Error(`SEC API error: ${res.status} ${res.statusText}`);
      }

      return res;
    },
    3,
    2000
  );

  const data: CompanyTickersData = await response.json();
  console.log(`Fetched ${Object.keys(data).length} companies from SEC`);

  // Batch upsert to database
  const companies = Object.values(data);
  const batchSize = 1000;

  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);

    await prisma.$transaction(
      batch.map((company) =>
        prisma.secCompanyCache.upsert({
          where: { cik: String(company.cik_str).padStart(10, "0") },
          update: {
            ticker: company.ticker,
            name: company.title,
            updatedAt: new Date(),
          },
          create: {
            cik: String(company.cik_str).padStart(10, "0"),
            ticker: company.ticker,
            name: company.title,
          },
        })
      )
    );

    console.log(
      `Cached ${Math.min(i + batchSize, companies.length)}/${companies.length} companies`
    );
  }

  console.log("SEC company cache refresh completed");
}

/**
 * Search companies by name using database cache
 * Automatically refreshes cache if stale
 */
export async function searchCompaniesByName(
  query: string
): Promise<CompanyMatch[]> {
  try {
    return await rateLimiter.schedule(async () => {
      // Check if cache needs refresh (but don't block on it)
      const needsRefresh = await shouldRefreshCache();

      if (needsRefresh) {
        console.log("Cache is stale, triggering background refresh...");
        // Trigger refresh in background (don't await)
        refreshSecCompanyCache().catch((error) => {
          console.error("Background cache refresh failed:", error);
        });
      }

      // Search in database cache
      const queryLower = query.toLowerCase();

      const companies = await prisma.secCompanyCache.findMany({
        where: {
          name: {
            contains: queryLower,
            mode: "insensitive",
          },
        },
        orderBy: [
          // Postgres doesn't have easy "starts with" ordering, so we fetch more and sort in memory
          { name: "asc" },
        ],
        take: 50, // Fetch more than needed for better sorting
      });

      // Sort by relevance in memory
      const sorted = companies
        .map((c) => ({
          cik: c.cik,
          ticker: c.ticker,
          name: c.name,
          nameIndex: c.name.toLowerCase().indexOf(queryLower),
        }))
        .sort((a, b) => {
          // Prioritize matches at start of name
          if (a.nameIndex !== b.nameIndex) return a.nameIndex - b.nameIndex;
          // Then by length (shorter names first)
          return a.name.length - b.name.length;
        })
        .slice(0, 10) // Return top 10
        .map(({ cik, ticker, name }) => ({ cik, ticker, name })); // Remove temp field

      return sorted;
    });
  } catch (error) {
    console.error("Error in searchCompaniesByName:", error);
    throw new Error(
      `Failed to search companies: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Fetch company CIK from ticker symbol
 */
export async function getCikFromTicker(ticker: string): Promise<string> {
  return rateLimiter.schedule(async () => {
    // Try database cache first
    const cached = await prisma.secCompanyCache.findFirst({
      where: {
        ticker: {
          equals: ticker.toUpperCase(),
          mode: "insensitive",
        },
      },
    });

    if (cached) {
      return cached.cik;
    }

    // Fallback to API
    const response = await fetchWithRetry(async () => {
      const res = await fetch(`${SEC_DATA_URL}/files/company_tickers.json`, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });

      if (!res.ok) {
        throw new Error(`SEC API error: ${res.status}`);
      }

      return res;
    });

    const data: CompanyTickersData = await response.json();

    // Find company by ticker
    const company = Object.values(data).find(
      (c) => c.ticker === ticker.toUpperCase()
    );

    if (!company) {
      throw new Error(`Ticker ${ticker} not found in SEC database`);
    }

    // Pad CIK to 10 digits
    return String(company.cik_str).padStart(10, "0");
  });
}

interface FilingMetadata {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
}

interface CompanySubmissions {
  cik: string;
  entityType: string;
  sic: string;
  sicDescription: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      acceptanceDateTime: string[];
      act: string[];
      form: string[];
      fileNumber: string[];
      filmNumber: string[];
      items: string[];
      size: number[];
      isXBRL: number[];
      isInlineXBRL: number[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

/**
 * Fetch company's recent filings metadata
 */
export async function getCompanyFilings(
  cik: string,
  filingType: string = "10-K"
): Promise<FilingMetadata[]> {
  return rateLimiter.schedule(async () => {
    const response = await fetchWithRetry(async () => {
      const res = await fetch(`${SEC_DATA_URL}/submissions/CIK${cik}.json`, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });

      if (!res.ok) {
        throw new Error(`SEC API error: ${res.status}`);
      }

      return res;
    });

    const data: CompanySubmissions = await response.json();

    // Filter for specific filing type
    const recentFilings = data.filings.recent;
    const filings: FilingMetadata[] = [];

    for (let i = 0; i < recentFilings.form.length; i++) {
      if (recentFilings.form[i] === filingType) {
        filings.push({
          accessionNumber: recentFilings.accessionNumber[i],
          filingDate: recentFilings.filingDate[i],
          reportDate: recentFilings.reportDate[i],
          primaryDocument: recentFilings.primaryDocument[i],
        });
      }
    }

    return filings;
  });
}

/**
 * Fetch SEC filing HTML content
 * @param cik Company CIK
 * @param accessionNumber Filing accession number
 * @param primaryDocument Optional primary document filename (e.g., "aapl-20240928.htm")
 *                        If provided, fetches the actual HTML document instead of the SGML wrapper
 */
export async function fetchSecFiling(
  cik: string,
  accessionNumber: string,
  primaryDocument?: string | null
): Promise<string> {
  return rateLimiter.schedule(async () => {
    // Remove dashes from accession number for URL path
    const accessionNumberNoDashes = accessionNumber.replace(/-/g, "");

    // Construct filing URL - use primary document if available, otherwise fallback to .txt
    // The primary document is the actual 10-K HTML, while .txt is the full SGML submission package
    const filename = primaryDocument || `${accessionNumber}.txt`;
    const filingUrl = `${SEC_BASE_URL}/Archives/edgar/data/${parseInt(
      cik
    )}/${accessionNumberNoDashes}/${filename}`;

    console.log(`Fetching SEC filing from: ${filingUrl}`);

    const response = await fetchWithRetry(async () => {
      const res = await fetch(filingUrl, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });

      if (!res.ok) {
        throw new Error(`SEC filing fetch error: ${res.status}`);
      }

      return res;
    });

    return await response.text();
  });
}

export interface FilingSections {
  business: string;
  riskFactors: string;
  mdAndA: string;
}

/**
 * Extract key sections from 10-K HTML/text content
 */
export function extractFilingSections(htmlContent: string): FilingSections {
  try {
    const $ = cheerio.load(htmlContent);
    const fullText = $("body").text() || "";

    const businessSection = extractSection(
      fullText,
      /item\s*1\b[^a]/i,
      /item\s*1a\b/i,
      20000
    );
    const riskFactors = extractSection(
      fullText,
      /item\s*1a\b/i,
      /item\s*1b\b/i,
      20000
    );
    const mdAndA = extractSection(
      fullText,
      /item\s*7\b[^a]/i,
      /item\s*7a\b/i,
      20000
    );

    return {
      business: businessSection || "Section not found",
      riskFactors: riskFactors || "Section not found",
      mdAndA: mdAndA || "Section not found",
    };
  } catch (error) {
    console.error("Error extracting filing sections:", error);
    return {
      business: "Extraction failed",
      riskFactors: "Extraction failed",
      mdAndA: "Extraction failed",
    };
  }
}

/**
 * Helper to extract text between two section markers
 */
function extractSection(
  fullText: string,
  startPattern: RegExp,
  endPattern: RegExp,
  maxChars: number
): string | null {
  const startMatch = fullText.match(startPattern);
  if (!startMatch || !startMatch.index) return null;

  const startIdx = startMatch.index;
  const textFromStart = fullText.substring(startIdx);

  const endMatch = textFromStart.match(endPattern);
  const endIdx = endMatch?.index || textFromStart.length;

  const sectionText = textFromStart.substring(0, endIdx);

  return sectionText.substring(0, maxChars).trim();
}

/**
 * Get the filing URL for viewing in browser
 */
export function getFilingViewerUrl(
  cik: string,
  accessionNumber: string
): string {
  return `${SEC_BASE_URL}/cgi-bin/viewer?action=view&cik=${cik}&accession_number=${accessionNumber}&xbrl_type=v`;
}

/**
 * Force refresh the SEC company cache
 * Use this for manual refresh or background jobs
 */
export async function forceRefreshSecCache(): Promise<void> {
  await refreshSecCompanyCache();
}
