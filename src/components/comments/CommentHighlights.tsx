// src/components/comments/CommentHighlights.tsx
// Component that renders highlights for inline comments on a page

"use client";

import { useEffect, useState } from "react";
import { useComments } from "./useComments";
import { InlineCommentPopover } from "./InlineCommentPopover";
import { CommentSheet } from "./CommentSheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { BREAKPOINTS } from "@/lib/constants";
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
  currentUser: {
    id: string;
    role: "ADMIN" | "MANAGER" | "REP" | "VIEWER";
    organizationId: string;
  };
  organizationUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }>;
}

export function CommentHighlights({
  entityType,
  entityId,
  organizationId,
  pageContext,
  enabled = true,
  currentUser,
  organizationUsers,
}: CommentHighlightsProps) {
  const { comments, isLoading } = useComments({
    entityType,
    entityId,
    organizationId,
    pageContext: pageContext || undefined,
    includeResolved: false, // Only show unresolved highlights
    enabled,
  });

  // State for inline popover/sheet
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);

  // Detect mobile/desktop using constant
  const isMobile = useMediaQuery(BREAKPOINTS.MOBILE_MAX_WIDTH);

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
          const highlightElements = highlightRange(range, {
            color: "#fef08a",
            className: `comment-highlight comment-highlight-${comment.id}`,
            commentId: comment.id,
            isResolved: comment.isResolved,
            authorId: comment.authorId,
            onClick: (element) => {
              // Open inline popover/sheet instead of sidebar
              setActiveCommentId(comment.id);
              setActiveElement(element);
            },
          });

          // Add hover effect to highlight elements
          highlightElements.forEach((el) => {
            el.style.cursor = "pointer";
            el.style.transition = "background-color 100ms ease-out";

            el.addEventListener("mouseenter", () => {
              if (activeCommentId !== comment.id) {
                el.style.backgroundColor = "#fde047"; // Darker yellow on hover
              }
            });

            el.addEventListener("mouseleave", () => {
              if (activeCommentId !== comment.id) {
                el.style.backgroundColor = "#fef08a"; // Return to default yellow
              }
            });
          });

          // Add active state if this is the active comment
          if (activeCommentId === comment.id) {
            highlightElements.forEach((el) => {
              el.style.backgroundColor = "#facc15"; // Bright yellow
              el.style.boxShadow = "0 0 0 2px #eab308";
            });
          }
        }
      } catch {
        // Silently skip comments that fail to render (e.g., selector no longer valid)
        // User feedback handled by toast notifications in useCommentActions
      }
    });

    // Cleanup highlights when component unmounts
    return () => {
      clearAllHighlights();
    };
  }, [comments, isLoading, enabled, activeCommentId]);

  // Render inline popover (desktop) or bottom sheet (mobile)
  return (
    <>
      {activeCommentId && !isMobile && (
        <InlineCommentPopover
          commentId={activeCommentId}
          isOpen={!!activeCommentId}
          onClose={() => {
            setActiveCommentId(null);
            setActiveElement(null);
          }}
          anchorElement={activeElement}
          entityType={entityType}
          entityId={entityId}
          organizationId={organizationId}
          currentUser={currentUser}
          organizationUsers={organizationUsers}
        />
      )}

      {activeCommentId && isMobile && (
        <CommentSheet
          commentId={activeCommentId}
          isOpen={!!activeCommentId}
          onClose={() => {
            setActiveCommentId(null);
            setActiveElement(null);
          }}
          entityType={entityType}
          entityId={entityId}
          organizationId={organizationId}
          currentUser={currentUser}
          organizationUsers={organizationUsers}
        />
      )}
    </>
  );
}
