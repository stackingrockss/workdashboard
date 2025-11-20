import { generateWithSystemInstruction } from "./gemini";

const SYSTEM_INSTRUCTION = `You are a financial analyst parsing earnings call transcripts for sales teams.

Extract the following from the transcript:

1. **Key Quotes** (array of objects)
   - Notable statements from executives (CEO, CFO, etc.)
   - Each quote: { "speaker": "Name", "quote": "text" }
   - Limit to top 5-7 most important quotes

2. **Revenue Guidance** (array of strings)
   - Forward-looking revenue statements
   - Guidance for next quarter/year
   - Growth targets

3. **Product Announcements** (array of strings)
   - New products or features mentioned
   - Product roadmap updates
   - Strategic partnerships

4. **Competitive Landscape** (string)
   - Competitor mentions
   - Market share commentary
   - Competitive advantages discussed

5. **Executive Sentiment** (enum)
   - "positive", "cautious", or "negative"
   - Based on tone and language used

Return ONLY valid JSON in this exact format:
{
  "keyQuotes": [
    { "speaker": "Tim Cook", "quote": "Best quarter ever..." }
  ],
  "revenueGuidance": ["Q1 revenue expected to grow 15%"],
  "productAnnouncements": ["Launching new AI features in Q2"],
  "competitiveLandscape": "Company maintaining market leadership...",
  "executiveSentiment": "positive",
  "fullSummary": "1-paragraph summary of the call for sales teams"
}`;

export interface KeyQuote {
  speaker: string;
  quote: string;
}

export interface EarningsTranscriptParsed {
  keyQuotes: KeyQuote[];
  revenueGuidance: string[];
  productAnnouncements: string[];
  competitiveLandscape: string;
  executiveSentiment: "positive" | "cautious" | "negative";
  fullSummary: string;
}

/**
 * Parse earnings call transcript using Gemini AI
 * @param transcriptText Full transcript text
 * @returns Structured parsed object with insights
 */
export async function parseEarningsTranscript(
  transcriptText: string
): Promise<EarningsTranscriptParsed> {
  // Limit transcript to first 30,000 chars to stay within token limits
  const truncatedTranscript = transcriptText.substring(0, 30000);

  const prompt = `Analyze the following earnings call transcript:

TRANSCRIPT:
${truncatedTranscript}

Return your analysis as JSON.`;

  const response = await generateWithSystemInstruction(
    prompt,
    SYSTEM_INSTRUCTION,
    "gemini-2.0-flash-exp" // Use 2.0 Flash for better analysis
  );

  if (response.error) {
    throw new Error(`Gemini API error: ${response.error}`);
  }

  // Clean and parse JSON
  let jsonText = response.text.trim();
  if (jsonText.startsWith("```json")) {
    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  }

  try {
    return JSON.parse(jsonText);
  } catch {
    console.error("Failed to parse Gemini response:", jsonText);
    throw new Error("Failed to parse AI response as JSON");
  }
}
