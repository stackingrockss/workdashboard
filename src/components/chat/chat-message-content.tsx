"use client";

import { parseContentCards } from "@/lib/utils/parse-content-cards";
import { ContentSuggestion } from "@/types/content-suggestion";
import { ContentSuggestionCard } from "./content-suggestion-card";

interface ChatMessageContentProps {
  content: string;
  onSaveContent: (suggestion: ContentSuggestion) => Promise<void>;
  savedUrls: Set<string>;
  savingUrls: Set<string>;
}

export function ChatMessageContent({
  content,
  onSaveContent,
  savedUrls,
  savingUrls,
}: ChatMessageContentProps) {
  // Parse content into text and card segments
  const segments = parseContentCards(content);

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <p key={index} className="text-sm whitespace-pre-wrap">
              {segment.content as string}
            </p>
          );
        } else {
          // Content card
          const suggestion = segment.content as ContentSuggestion;
          const isSaving = savingUrls.has(suggestion.url);
          const isSaved = savedUrls.has(suggestion.url);

          return (
            <ContentSuggestionCard
              key={index}
              suggestion={suggestion}
              isSaving={isSaving}
              isSaved={isSaved}
              onSave={() => onSaveContent(suggestion)}
            />
          );
        }
      })}
    </div>
  );
}
