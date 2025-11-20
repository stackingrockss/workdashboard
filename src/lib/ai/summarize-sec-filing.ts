import { generateWithSystemInstruction } from "./gemini";
import type { FilingSections } from "../integrations/sec-edgar";

const SYSTEM_INSTRUCTION = `You are a financial analyst specializing in SEC 10-K filing analysis for sales teams.

Extract and summarize the following from the SEC filing sections provided:

1. **Business Overview** (2-3 sentences)
   - What does the company do?
   - Main revenue streams
   - Market position

2. **Risk Factors** (array)
   - Top 5-10 material risks facing the business
   - Each risk as a concise sentence

3. **Financial Highlights** (JSON object)
   - Revenue trends mentioned
   - Profitability metrics
   - Key financial ratios or metrics

4. **Strategic Initiatives** (2-3 sentences)
   - Major strategic plans
   - Product launches or expansions
   - M&A activity

Return ONLY valid JSON in this exact format:
{
  "businessOverview": "string",
  "riskFactors": ["risk1", "risk2", ...],
  "financialHighlights": {
    "revenue": "string",
    "profitability": "string",
    "trends": "string"
  },
  "strategicInitiatives": "string",
  "fullSummary": "comprehensive 1-paragraph summary suitable for sales teams"
}`;

export interface SecFilingSummary {
  businessOverview: string;
  riskFactors: string[];
  financialHighlights: {
    revenue: string;
    profitability: string;
    trends: string;
  };
  strategicInitiatives: string;
  fullSummary: string;
}

/**
 * Summarize SEC 10-K filing using Gemini AI
 * @param sections Extracted filing sections (Business, Risk Factors, MD&A)
 * @returns Structured summary object
 */
export async function summarizeSecFiling(
  sections: FilingSections
): Promise<SecFilingSummary> {
  const prompt = `Analyze the following SEC 10-K filing sections:

BUSINESS SECTION:
${sections.business}

RISK FACTORS:
${sections.riskFactors}

MD&A (Management Discussion & Analysis):
${sections.mdAndA}

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
  } catch (error) {
    console.error("Failed to parse Gemini response:", jsonText);
    throw new Error("Failed to parse AI response as JSON");
  }
}
