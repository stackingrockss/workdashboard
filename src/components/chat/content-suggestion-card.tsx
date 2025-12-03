"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Copy,
  ExternalLink,
  FileText,
  BookOpen,
  Video,
  Presentation,
  File,
  Check,
  Loader2,
  FileSpreadsheet,
  Briefcase,
} from "lucide-react";
import { ContentSuggestion } from "@/types/content-suggestion";
import { ContentType, CONTENT_TYPE_LABELS } from "@/types/content";

interface ContentSuggestionCardProps {
  suggestion: ContentSuggestion;
  isSaving: boolean;
  isSaved: boolean;
  onSave: () => void;
}

const contentTypeIcons: Record<ContentType, React.ReactNode> = {
  blog_post: <FileText className="h-3 w-3" />,
  case_study: <BookOpen className="h-3 w-3" />,
  whitepaper: <File className="h-3 w-3" />,
  video: <Video className="h-3 w-3" />,
  webinar: <Presentation className="h-3 w-3" />,
  mutual_action_plan: <FileSpreadsheet className="h-3 w-3" />,
  business_case: <Briefcase className="h-3 w-3" />,
  other: <FileText className="h-3 w-3" />,
};

const contentTypeBadgeColors: Record<ContentType, string> = {
  blog_post: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  case_study: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  whitepaper: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  video: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  webinar: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  mutual_action_plan: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100",
  business_case: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
};

export function ContentSuggestionCard({
  suggestion,
  isSaving,
  isSaved,
  onSave,
}: ContentSuggestionCardProps) {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyLink = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(suggestion.url);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    } finally {
      setIsCopying(false);
    }
  };

  const handleOpenExternal = () => {
    window.open(suggestion.url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className="my-2 border-2 hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {contentTypeIcons[suggestion.contentType]}
            <Badge
              variant="secondary"
              className={`${contentTypeBadgeColors[suggestion.contentType]} text-xs`}
            >
              {CONTENT_TYPE_LABELS[suggestion.contentType]}
            </Badge>
          </div>
          <Badge
            variant="secondary"
            className={
              suggestion.source === "internal"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs"
                : isSaved
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 text-xs"
            }
          >
            {suggestion.source === "internal"
              ? "In Library"
              : isSaved
              ? "Saved to Library"
              : "Web Result"}
          </Badge>
        </div>

        {/* Title */}
        <h4 className="font-semibold text-sm mb-1 line-clamp-2">{suggestion.title}</h4>

        {/* Description */}
        {suggestion.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {suggestion.description}
          </p>
        )}

        {/* Relevance Reason */}
        <p className="text-xs italic text-muted-foreground mb-3 line-clamp-2">
          → {suggestion.relevanceReason}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            disabled={isCopying}
            className="text-xs h-7"
          >
            {isCopying ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Copy className="h-3 w-3 mr-1" />
            )}
            Copy Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenExternal}
            className="text-xs h-7"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open
          </Button>
          {suggestion.source === "web" && !isSaved && (
            <Button
              variant="default"
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="text-xs h-7"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save to Library"
              )}
            </Button>
          )}
          {suggestion.source === "web" && isSaved && (
            <Button variant="outline" size="sm" disabled className="text-xs h-7">
              <Check className="h-3 w-3 mr-1" />
              Saved
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
