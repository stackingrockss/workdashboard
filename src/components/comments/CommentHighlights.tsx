// src/components/comments/CommentHighlights.tsx
// Component that renders highlights for inline comments on a page

"use client";

import { useEffect } from "react";
import { useComments, type Comment } from "./useComments";
import { useCommentSidebar } from "./CommentSidebarContext";
import {
  restoreTextSelection,
  highlightRange,
  clearAllHighlights,
  type TextSelection,
} from "@/lib/text-selection";

interface CommentHighlightsProps {
  entityType: string;
  entityId: string;
  organizationId: string;
  pageContext?: string;
  enabled?: boolean;
}

export function CommentHighlights({
  entityType,
  entityId,
  organizationId,
  pageContext,
  enabled = true,
}: CommentHighlightsProps) {
  const { comments, isLoading } = useComments({
    entityType,
    entityId,
    organizationId,
    pageContext: pageContext || undefined,
    includeResolved: false, // Only show unresolved highlights
    enabled,
  });

  const { openSidebar, selectComment } = useCommentSidebar();

  useEffect(() => {
    if (!enabled || isLoading) return;

    // Clear existing highlights
    clearAllHighlights();

    // Filter comments that have text selections
    const inlineComments = comments.filter(
      (comment) =>
        comment.selectionType === "text" &&
        comment.anchorSelector &&
        comment.focusSelector &&
        !comment.isResolved
    );

    // Render highlights for each inline comment
    inlineComments.forEach((comment) => {
      try {
        const selection: TextSelection = {
          selectionType: comment.selectionType as "text" | "element",
          anchorSelector: comment.anchorSelector!,
          anchorOffset: comment.anchorOffset!,
          focusSelector: comment.focusSelector!,
          focusOffset: comment.focusOffset!,
          selectedText: comment.selectedText!,
        };

        const range = restoreTextSelection(selection);

        if (range) {
          highlightRange(range, {
            color: "#ffeb3b",
            className: `comment-highlight comment-highlight-${comment.id}`,
            onClick: () => {
              // Open sidebar and scroll to comment
              openSidebar(entityType, entityId, pageContext);
              selectComment(comment.id);
            },
          });
        }
      } catch (error) {
        console.error("Error rendering highlight for comment:", comment.id, error);
      }
    });

    // Cleanup highlights when component unmounts
    return () => {
      clearAllHighlights();
    };
  }, [comments, isLoading, enabled, entityType, entityId, pageContext, openSidebar, selectComment]);

  // This component doesn't render anything visible
  return null;
}
