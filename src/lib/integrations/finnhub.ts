// src/lib/integrations/finnhub.ts
// Finnhub API integration for earnings transcripts and calendar
// Free tier: 60 API calls/minute
// Docs: https://finnhub.io/docs/api

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

interface EarningsCalendarEvent {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string; // "bmo" (before market open), "amc" (after market close), "dmh" (during market hours)
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

interface EarningsCalendarResponse {
  earningsCalendar: EarningsCalendarEvent[];
}

interface TranscriptListItem {
  id: string;
  quarter: number;
  symbol: string;
  time: string;
  title: string;
  year: number;
}

interface TranscriptListResponse {
  symbol: string;
  transcripts: TranscriptListItem[];
}

interface TranscriptSpeech {
  session: string; // "Prepared Remarks" or "Questions and Answers"
  name: string;
  speech: string[];
}

interface TranscriptParticipant {
  description: string;
  name: string;
  role: string;
}

interface TranscriptResponse {
  audio: string;
  id: string;
  participant: TranscriptParticipant[];
  quarter: number;
  symbol: string;
  time: string;
  title: string;
  transcript: TranscriptSpeech[];
  year: number;
}

/**
 * Check if Finnhub API key is configured
 */
export function isFinnhubConfigured(): boolean {
  return !!FINNHUB_API_KEY;
}

/**
 * Make authenticated request to Finnhub API
 */
async function finnhubFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  if (!FINNHUB_API_KEY) {
    throw new Error(
      "FINNHUB_API_KEY environment variable is not set. Please add it to your .env file."
    );
  }

  const searchParams = new URLSearchParams({
    ...params,
    token: FINNHUB_API_KEY,
  });

  const url = `${FINNHUB_BASE_URL}${endpoint}?${searchParams.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Finnhub API authentication failed. Check your API key.");
    }
    if (response.status === 429) {
      throw new Error("Finnhub API rate limit exceeded. Please wait and try again.");
    }
    throw new Error(`Finnhub API error: ${response.status} - ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get earnings calendar for a specific symbol
 * @param symbol Stock ticker symbol
 * @param from Start date (YYYY-MM-DD)
 * @param to End date (YYYY-MM-DD)
 */
export async function getEarningsCalendar(
  symbol?: string,
  from?: string,
  to?: string
): Promise<EarningsCalendarEvent[]> {
  const params: Record<string, string> = {};

  if (symbol) params.symbol = symbol.toUpperCase();
  if (from) params.from = from;
  if (to) params.to = to;

  // If no date range specified, default to next 90 days
  if (!from && !to) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);

    params.from = today.toISOString().split("T")[0];
    params.to = futureDate.toISOString().split("T")[0];
  }

  const response = await finnhubFetch<EarningsCalendarResponse>("/calendar/earnings", params);

  // If symbol specified, filter results (API may return all symbols in date range)
  if (symbol) {
    return response.earningsCalendar.filter(
      (e) => e.symbol.toUpperCase() === symbol.toUpperCase()
    );
  }

  return response.earningsCalendar;
}

/**
 * Get next earnings date for a symbol
 * @param symbol Stock ticker symbol
 */
export async function getNextEarningsDate(
  symbol: string
): Promise<{ date: Date; isEstimate: boolean; source: string; hour: string } | null> {
  try {
    const earnings = await getEarningsCalendar(symbol);

    if (!earnings || earnings.length === 0) {
      return null;
    }

    // Find next upcoming earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = earnings
      .filter((e) => new Date(e.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcoming.length === 0) {
      return null;
    }

    const next = upcoming[0];

    return {
      date: new Date(next.date),
      isEstimate: false,
      source: "finnhub",
      hour: next.hour,
    };
  } catch (error) {
    console.error(`Error fetching earnings date for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get list of available earnings transcripts for a symbol
 * @param symbol Stock ticker symbol
 */
export async function getTranscriptList(symbol: string): Promise<TranscriptListItem[]> {
  const response = await finnhubFetch<TranscriptListResponse>("/stock/transcripts/list", {
    symbol: symbol.toUpperCase(),
  });

  return response.transcripts || [];
}

/**
 * Get full earnings call transcript
 * @param transcriptId Transcript ID from getTranscriptList
 */
export async function getTranscript(transcriptId: string): Promise<TranscriptResponse> {
  return await finnhubFetch<TranscriptResponse>("/stock/transcripts", {
    id: transcriptId,
  });
}

/**
 * Get the most recent earnings transcript for a symbol
 * @param symbol Stock ticker symbol
 */
export async function getLatestTranscript(symbol: string): Promise<TranscriptResponse | null> {
  try {
    const transcripts = await getTranscriptList(symbol);

    if (!transcripts || transcripts.length === 0) {
      return null;
    }

    // Get the most recent transcript (list is typically sorted by date desc)
    const latest = transcripts[0];
    return await getTranscript(latest.id);
  } catch (error) {
    console.error(`Error fetching transcript for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get transcript for a specific quarter
 * @param symbol Stock ticker symbol
 * @param year Fiscal year
 * @param quarter Quarter number (1-4)
 */
export async function getTranscriptByQuarter(
  symbol: string,
  year: number,
  quarter: number
): Promise<TranscriptResponse | null> {
  try {
    const transcripts = await getTranscriptList(symbol);

    const match = transcripts.find((t) => t.year === year && t.quarter === quarter);

    if (!match) {
      return null;
    }

    return await getTranscript(match.id);
  } catch (error) {
    console.error(`Error fetching transcript for ${symbol} Q${quarter} ${year}:`, error);
    return null;
  }
}

/**
 * Format transcript content as readable text
 * @param transcript Transcript response from API
 */
export function formatTranscriptAsText(transcript: TranscriptResponse): string {
  const lines: string[] = [];

  lines.push(`# ${transcript.title}`);
  lines.push(`**Symbol:** ${transcript.symbol}`);
  lines.push(`**Date:** ${transcript.time}`);
  lines.push(`**Quarter:** Q${transcript.quarter} ${transcript.year}`);
  lines.push("");

  // Add participants section
  if (transcript.participant && transcript.participant.length > 0) {
    lines.push("## Participants");
    for (const participant of transcript.participant) {
      lines.push(`- **${participant.name}** - ${participant.role}`);
      if (participant.description) {
        lines.push(`  ${participant.description}`);
      }
    }
    lines.push("");
  }

  // Add transcript content
  if (transcript.transcript && transcript.transcript.length > 0) {
    for (const speech of transcript.transcript) {
      lines.push(`## ${speech.session}`);
      lines.push("");
      lines.push(`**${speech.name}:**`);
      lines.push("");
      for (const paragraph of speech.speech) {
        lines.push(paragraph);
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

export type {
  EarningsCalendarEvent,
  TranscriptListItem,
  TranscriptResponse,
  TranscriptSpeech,
  TranscriptParticipant,
};
