/**
 * Utility to format Gong transcripts into readable text for AI parsing
 */

import type { GongTranscript, GongParty } from './types';

/**
 * Format milliseconds to MM:SS timestamp
 */
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Build a speaker map from parties array
 * Maps speakerId to speaker name
 */
function buildSpeakerMap(parties: GongParty[]): Map<string, string> {
  const speakerMap = new Map<string, string>();

  for (const party of parties) {
    if (party.speakerId) {
      const displayName = party.name || party.emailAddress || `Speaker ${party.speakerId}`;
      const contextLabel = party.context === 'External' ? ' (External)' : '';
      speakerMap.set(party.speakerId, `${displayName}${contextLabel}`);
    }
  }

  return speakerMap;
}

/**
 * Format Gong transcript into readable text for AI parsing
 *
 * Output format:
 * [00:00] Speaker Name (External): Transcript text here...
 * [00:15] Internal Rep: Response text...
 */
export function formatGongTranscript(
  transcript: GongTranscript,
  parties: GongParty[]
): string {
  const speakerMap = buildSpeakerMap(parties);
  const lines: string[] = [];

  for (const entry of transcript.transcript) {
    const speakerName = speakerMap.get(entry.speakerId) || `Unknown Speaker (${entry.speakerId})`;

    // Combine all sentences for this speaker turn
    const text = entry.sentences.map(s => s.text).join(' ');

    // Get the timestamp from the first sentence
    const timestamp = entry.sentences[0]?.start ?? 0;
    const formattedTimestamp = formatTimestamp(timestamp);

    // Add topic marker if present
    const topicPrefix = entry.topic ? `[Topic: ${entry.topic}] ` : '';

    lines.push(`[${formattedTimestamp}] ${speakerName}: ${topicPrefix}${text}`);
  }

  return lines.join('\n\n');
}

/**
 * Format transcript with detailed timestamps for each sentence
 * Useful for more granular analysis
 */
export function formatGongTranscriptDetailed(
  transcript: GongTranscript,
  parties: GongParty[]
): string {
  const speakerMap = buildSpeakerMap(parties);
  const lines: string[] = [];

  for (const entry of transcript.transcript) {
    const speakerName = speakerMap.get(entry.speakerId) || `Unknown Speaker (${entry.speakerId})`;

    // Add a speaker header
    lines.push(`--- ${speakerName} ---`);

    // Add each sentence with its timestamp
    for (const sentence of entry.sentences) {
      const timestamp = formatTimestamp(sentence.start);
      lines.push(`[${timestamp}] ${sentence.text}`);
    }

    lines.push(''); // Empty line between speakers
  }

  return lines.join('\n');
}

/**
 * Extract just the text without timestamps or speaker labels
 * Useful for simple text analysis
 */
export function extractTranscriptText(transcript: GongTranscript): string {
  return transcript.transcript
    .flatMap(entry => entry.sentences.map(s => s.text))
    .join(' ');
}

/**
 * Get transcript statistics
 */
export function getTranscriptStats(
  transcript: GongTranscript,
  parties: GongParty[]
): {
  totalDurationMs: number;
  speakerStats: Array<{
    speakerId: string;
    speakerName: string;
    isExternal: boolean;
    turnCount: number;
    wordCount: number;
    durationMs: number;
  }>;
} {
  const speakerMap = buildSpeakerMap(parties);
  const partyMap = new Map(parties.map(p => [p.speakerId, p]));
  const stats = new Map<string, {
    turnCount: number;
    wordCount: number;
    durationMs: number;
  }>();

  let totalDurationMs = 0;

  for (const entry of transcript.transcript) {
    const speakerId = entry.speakerId;
    const existing = stats.get(speakerId) || { turnCount: 0, wordCount: 0, durationMs: 0 };

    const words = entry.sentences.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
    const duration = entry.sentences.reduce((sum, s) => sum + (s.end - s.start), 0);

    stats.set(speakerId, {
      turnCount: existing.turnCount + 1,
      wordCount: existing.wordCount + words,
      durationMs: existing.durationMs + duration,
    });

    const lastSentence = entry.sentences[entry.sentences.length - 1];
    if (lastSentence && lastSentence.end > totalDurationMs) {
      totalDurationMs = lastSentence.end;
    }
  }

  const speakerStats = Array.from(stats.entries()).map(([speakerId, data]) => {
    const party = partyMap.get(speakerId);
    return {
      speakerId,
      speakerName: speakerMap.get(speakerId) || `Unknown (${speakerId})`,
      isExternal: party?.context === 'External',
      ...data,
    };
  });

  return { totalDurationMs, speakerStats };
}
