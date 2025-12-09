import * as cheerio from "cheerio";

const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT || "SalesTracker admin@example.com";
const SEC_BASE_URL = "https://www.sec.gov";
const SEC_DATA_URL = "https://data.sec.gov";

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

/**
 * Cache for company tickers to avoid repeated fetches (1.5MB file)
 */
let companyTickersCache: {
  data: CompanyTickersData;
  timestamp: number;
} | null = null;

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch company CIK from ticker symbol
 */
export interface CompanyMatch {
  cik: string;
  ticker: string;
  name: string;
}

/**
 * Fetch company CIK from ticker symbol
 */
export async function getCikFromTicker(ticker: string): Promise<string> {
  return rateLimiter.schedule(async () => {
    const response = await fetch(
      `${SEC_BASE_URL}/files/company_tickers.json`,
      {
        headers: { "User-Agent": SEC_USER_AGENT },
      }
    );

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status}`);
    }

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

/**
 * Fetch and cache company tickers data
 * Uses 24-hour cache to reduce bandwidth and improve performance
 */
async function getCompanyTickersData(): Promise<CompanyTickersData> {
  try {
    // Check if cache is valid
    if (
      companyTickersCache &&
      Date.now() - companyTickersCache.timestamp < CACHE_TTL
    ) {
      console.log("Using cached company tickers data");
      return companyTickersCache.data;
    }

    console.log("Fetching fresh company tickers data from SEC...");
    // Fetch fresh data
    const response = await fetch(
      `${SEC_DATA_URL}/files/company_tickers.json`,
      {
        headers: { "User-Agent": SEC_USER_AGENT },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read error");
      console.error(`SEC API error: ${response.status} - ${errorText}`);
      throw new Error(`SEC API error: ${response.status} ${response.statusText}`);
    }

    const data: CompanyTickersData = await response.json();
    console.log(`Successfully fetched ${Object.keys(data).length} companies from SEC`);

    // Update cache
    companyTickersCache = {
      data,
      timestamp: Date.now(),
    };

    return data;
  } catch (error) {
    console.error("Error fetching company tickers data:", error);
    throw error;
  }
}

/**
 * Search companies by name
 * Returns top 10 matches from SEC database
 * Uses cached data to improve performance (24hr TTL)
 */
export async function searchCompaniesByName(query: string): Promise<CompanyMatch[]> {
  try {
    return await rateLimiter.schedule(async () => {
      const data = await getCompanyTickersData();
      const queryLower = query.toLowerCase();

      // Filter and sort companies by name match
      const matches = Object.values(data)
        .filter((c) => c.title.toLowerCase().includes(queryLower))
        .sort((a, b) => {
          // Prioritize matches at start of name
          const aIndex = a.title.toLowerCase().indexOf(queryLower);
          const bIndex = b.title.toLowerCase().indexOf(queryLower);
          if (aIndex !== bIndex) return aIndex - bIndex;
          // Then by length (shorter names first)
          return a.title.length - b.title.length;
        })
        .slice(0, 10) // Top 10 matches
        .map((c) => ({
          cik: String(c.cik_str).padStart(10, "0"),
          ticker: c.ticker,
          name: c.title,
        }));

      return matches;
    });
  } catch (error) {
    console.error("Error in searchCompaniesByName:", error);
    throw new Error(`Failed to search companies: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
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
    const response = await fetch(
      `${SEC_DATA_URL}/submissions/CIK${cik}.json`,
      {
        headers: { "User-Agent": SEC_USER_AGENT },
      }
    );

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status}`);
    }

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

    const response = await fetch(filingUrl, {
      headers: { "User-Agent": SEC_USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`SEC filing fetch error: ${response.status}`);
    }

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
 * Note: SEC filings have inconsistent HTML structure, so this uses simple text extraction
 *
 * Common 10-K section header formats:
 * - "Item 1. Business"
 * - "ITEM 1. BUSINESS"
 * - "Item 1—Business" (em-dash)
 * - "Item 1 - Business" (hyphen)
 * - "ITEM 1A. RISK FACTORS"
 * - "Item 1A—Risk Factors"
 * - "Part I, Item 1"
 */
export function extractFilingSections(htmlContent: string): FilingSections {
  try {
    // Load HTML content with cheerio (ESM-compatible, serverless-friendly)
    const $ = cheerio.load(htmlContent);
    const fullText = $("body").text() || "";

    // More robust patterns that handle common 10-K formatting variations
    // Pattern explanation:
    // - \bitem\s* - word boundary + "item" + optional whitespace
    // - [:\.\s]* - optional colon, period, or whitespace after number
    // - (?:[\.\s\-—:]+|[\s]+) - separator (period, space, dash, em-dash, colon)
    // - The section title keywords help avoid matching table of contents entries

    // Item 1 Business - match "Item 1" followed by "Business" keyword (skips TOC entries)
    const businessSection = extractSectionWithKeyword(
      fullText,
      // Start: "Item 1" followed by separator and "Business" keyword
      /\bitem\s*1[:\.\s]*(?:[\.\s\-—:]+|[\s]+)business\b/i,
      // End: "Item 1A" or "Item 1B" or "Part II"
      /\bitem\s*1\s*a\b|\bitem\s*1\s*b\b|\bpart\s*ii\b/i,
      20000
    );

    // Item 1A Risk Factors - match "Item 1A" followed by "Risk" keyword
    const riskFactors = extractSectionWithKeyword(
      fullText,
      // Start: "Item 1A" followed by separator and "Risk" keyword
      /\bitem\s*1\s*a[:\.\s]*(?:[\.\s\-—:]+|[\s]+)risk/i,
      // End: "Item 1B" or "Item 2" or "Part II"
      /\bitem\s*1\s*b\b|\bitem\s*2\b|\bpart\s*ii\b/i,
      20000
    );

    // Item 7 MD&A - match "Item 7" followed by "Management" keyword
    const mdAndA = extractSectionWithKeyword(
      fullText,
      // Start: "Item 7" followed by separator and "Management" keyword
      /\bitem\s*7[:\.\s]*(?:[\.\s\-—:]+|[\s]+)management/i,
      // End: "Item 7A" or "Item 8"
      /\bitem\s*7\s*a\b|\bitem\s*8\b/i,
      20000
    );

    // Fallback to simpler patterns if keyword matching failed
    const fallbackBusiness = businessSection || extractSection(
      fullText,
      /\bitem\s*1\b(?!\s*a)/i,
      /\bitem\s*1\s*a\b/i,
      20000
    );

    const fallbackRiskFactors = riskFactors || extractSection(
      fullText,
      /\bitem\s*1\s*a\b/i,
      /\bitem\s*1\s*b\b|\bitem\s*2\b/i,
      20000
    );

    const fallbackMdAndA = mdAndA || extractSection(
      fullText,
      /\bitem\s*7\b(?!\s*a)/i,
      /\bitem\s*7\s*a\b|\bitem\s*8\b/i,
      20000
    );

    return {
      business: fallbackBusiness || "Section not found",
      riskFactors: fallbackRiskFactors || "Section not found",
      mdAndA: fallbackMdAndA || "Section not found",
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
 * Extract section using a keyword-aware pattern that finds the actual section content
 * (not table of contents entries)
 */
function extractSectionWithKeyword(
  fullText: string,
  startPattern: RegExp,
  endPattern: RegExp,
  maxChars: number
): string | null {
  // Find all matches of the start pattern
  const matches: number[] = [];
  let match: RegExpExecArray | null;
  const globalPattern = new RegExp(startPattern.source, startPattern.flags + (startPattern.flags.includes('g') ? '' : 'g'));

  while ((match = globalPattern.exec(fullText)) !== null) {
    matches.push(match.index);
  }

  if (matches.length === 0) return null;

  // Use the LAST match, which is more likely to be the actual section
  // (table of contents entries come first in 10-Ks)
  // But skip if it's too close to the end (might be an index)
  let startIdx = matches[matches.length - 1];

  // If there are multiple matches and the last one is near the end, use second-to-last
  if (matches.length > 1 && startIdx > fullText.length * 0.9) {
    startIdx = matches[matches.length - 2];
  }

  const textFromStart = fullText.substring(startIdx);
  const endMatch = textFromStart.match(endPattern);
  const endIdx = endMatch?.index || Math.min(textFromStart.length, maxChars * 2);

  const sectionText = textFromStart.substring(0, endIdx);
  return sectionText.substring(0, maxChars).trim();
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

  // Limit to max chars to stay within AI token limits
  return sectionText.substring(0, maxChars).trim();
}

/**
 * Get the filing URL for viewing in browser
 */
export function getFilingViewerUrl(cik: string, accessionNumber: string): string {
  return `${SEC_BASE_URL}/cgi-bin/viewer?action=view&cik=${cik}&accession_number=${accessionNumber}&xbrl_type=v`;
}

/**
 * Estimate next earnings date based on historical filing patterns
 * Companies typically file 10-Q ~45 days after quarter end
 * @param ticker Stock ticker symbol
 */
export async function estimateNextEarningsDate(
  ticker: string
): Promise<{ date: Date; isEstimate: boolean; source: string } | null> {
  try {
    const cik = await getCikFromTicker(ticker);

    // Fetch company submissions to get recent filings
    const response = await rateLimiter.schedule(async () => {
      const res = await fetch(`${SEC_DATA_URL}/submissions/CIK${cik}.json`, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });
      if (!res.ok) {
        throw new Error(`SEC API error: ${res.status}`);
      }
      return res.json() as Promise<CompanySubmissions>;
    });

    const recentFilings = response.filings.recent;

    // Get recent 10-Q and 10-K filings to analyze patterns
    const quarterlyFilings: Array<{ form: string; filingDate: string; reportDate: string }> = [];

    for (let i = 0; i < recentFilings.form.length && quarterlyFilings.length < 8; i++) {
      const form = recentFilings.form[i];
      if (form === "10-Q" || form === "10-K") {
        quarterlyFilings.push({
          form,
          filingDate: recentFilings.filingDate[i],
          reportDate: recentFilings.reportDate[i],
        });
      }
    }

    if (quarterlyFilings.length === 0) {
      return null;
    }

    // Calculate average days between report date and filing date
    const reportToFilingDays: number[] = [];
    for (const filing of quarterlyFilings) {
      if (filing.reportDate && filing.filingDate) {
        const reportDate = new Date(filing.reportDate);
        const filingDate = new Date(filing.filingDate);
        const daysDiff = Math.floor(
          (filingDate.getTime() - reportDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 0 && daysDiff < 90) {
          reportToFilingDays.push(daysDiff);
        }
      }
    }

    const avgDaysToFile =
      reportToFilingDays.length > 0
        ? Math.round(
            reportToFilingDays.reduce((a, b) => a + b, 0) / reportToFilingDays.length
          )
        : 45; // Default to 45 days

    // Get the most recent report date
    const lastReportDate = new Date(quarterlyFilings[0].reportDate);

    // Estimate next quarter end (add ~90 days)
    const nextQuarterEnd = new Date(lastReportDate);
    nextQuarterEnd.setDate(nextQuarterEnd.getDate() + 90);

    // Estimate filing date
    const estimatedFilingDate = new Date(nextQuarterEnd);
    estimatedFilingDate.setDate(estimatedFilingDate.getDate() + avgDaysToFile);

    // If estimated date is in the past, add another quarter
    const today = new Date();
    if (estimatedFilingDate < today) {
      estimatedFilingDate.setDate(estimatedFilingDate.getDate() + 90);
    }

    return {
      date: estimatedFilingDate,
      isEstimate: true,
      source: "sec-edgar",
    };
  } catch (error) {
    console.error(`Error estimating earnings date for ${ticker}:`, error);
    return null;
  }
}
