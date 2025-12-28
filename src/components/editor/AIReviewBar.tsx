"use client";

import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AIReviewBarProps {
  onAccept: () => void;
  onDiscard: () => void;
  isStreaming?: boolean;
  className?: string;
}

/**
 * Floating action bar for reviewing AI-generated content
 * Shows Accept and Discard buttons below pending AI content
 */
export function AIReviewBar({
  onAccept,
  onDiscard,
  isStreaming = false,
  className,
}: AIReviewBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 py-2 px-3 rounded-lg",
        "bg-background border border-purple-200 dark:border-purple-800",
        "shadow-lg animate-in fade-in slide-in-from-top-2 duration-200",
        className
      )}
    >
      {isStreaming ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
          <span className="text-sm text-muted-foreground">
            AI is writing...
          </span>
        </>
      ) : (
        <>
          <span className="text-sm text-muted-foreground mr-2">
            Review AI changes
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDiscard}
            className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-4 w-4 mr-1" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={onAccept}
            className="h-7 px-3 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Check className="h-4 w-4 mr-1" />
            Accept
          </Button>
        </>
      )}
    </div>
  );
}
