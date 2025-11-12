import type { MeetingBriefMetadata } from "@/types/opportunity";

export interface FormattedMeetingBrief {
  fullBrief: string;
  mobileCheatSheet: string;
  metadata: MeetingBriefMetadata;
}

/**
 * Format meeting brief from raw text into structured format
 * This is a simple passthrough for now - the AI already generates
 * the content in the correct format
 */
export function formatMeetingBrief(rawText: string): FormattedMeetingBrief {
  // Parse the JSON response from the AI
  const parsed = JSON.parse(rawText);

  return {
    fullBrief: parsed.fullBrief || "",
    mobileCheatSheet: parsed.mobileCheatSheet || "",
    metadata: parsed.metadata || {
      executiveSummary: {
        criticalInsight: "",
        topQuestions: [],
        keyMetrics: [],
        risks: [],
      },
      quickReference: {
        conversationStarters: [],
        discoveryQuestions: [],
        financials: [],
      },
    },
  };
}
