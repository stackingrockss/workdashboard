"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
            <div key={index} className="text-sm prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {segment.content as string}
              </ReactMarkdown>
            </div>
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
