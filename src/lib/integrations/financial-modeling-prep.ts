const FMP_API_KEY = process.env.FMP_API_KEY;
const FMP_BASE_URL = "https://financialmodelingprep.com/api/v3";

interface EarningsTranscriptResponse {
  symbol: string;
  quarter: number;
  year: number;
  date: string;
  content: string;
}

/**
 * Fetch earnings call transcript from Financial Modeling Prep API
 * @param ticker Stock ticker symbol (e.g., "AAPL")
 * @param year Fiscal year
 * @param quarter Quarter number (1, 2, 3, or 4)
 */
export async function fetchEarningsTranscript(
  ticker: string,
  year: number,
  quarter: string
): Promise<string> {
  if (!FMP_API_KEY) {
    throw new Error(
      "FMP_API_KEY environment variable is not set. Please add it to your .env file."
    );
  }

  const quarterNum = quarter.replace("Q", ""); // "Q1" -> "1"

  const url = `${FMP_BASE_URL}/earning_call_transcript/${ticker.toUpperCase()}?year=${year}&quarter=${quarterNum}&apikey=${FMP_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "FMP API authentication failed. Check your API key or quota limits."
      );
    }
    throw new Error(
      `FMP API error: ${response.status} - ${response.statusText}`
    );
  }

  const data: EarningsTranscriptResponse[] = await response.json();

  if (Array.isArray(data) && data.length > 0) {
    // FMP returns array, we want the first (most recent) transcript
    return data[0].content || "";
  }

  throw new Error(`No transcript found for ${ticker} ${quarter} ${year}`);
}

interface EarningsCalendar {
  symbol: string;
  date: string;
  eps: number | null;
  epsEstimated: number | null;
  time: string;
  revenue: number | null;
  revenueEstimated: number | null;
  fiscalDateEnding: string;
}

/**
 * Get earnings calendar (upcoming and historical earnings dates)
 * @param ticker Stock ticker symbol
 */
export async function getEarningsCalendar(
  ticker: string
): Promise<EarningsCalendar[]> {
  if (!FMP_API_KEY) {
    throw new Error(
      "FMP_API_KEY environment variable is not set. Please add it to your .env file."
    );
  }

  const url = `${FMP_BASE_URL}/historical/earning_calendar/${ticker.toUpperCase()}?apikey=${FMP_API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "FMP API authentication failed. Check your API key or quota limits."
      );
    }
    throw new Error(
      `FMP API error: ${response.status} - ${response.statusText}`
    );
  }

  return await response.json();
}
