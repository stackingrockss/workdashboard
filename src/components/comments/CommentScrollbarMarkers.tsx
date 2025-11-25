// src/components/comments/CommentScrollbarMarkers.tsx
// Renders colored markers on the scrollbar showing comment distribution on the page

"use client";

import { useCommentPositions } from "@/hooks/useCommentPositions";
import { useComments, type Comment } from "./useComments";
import { useCommentSidebar } from "./CommentSidebarContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface CommentScrollbarMarkersProps {
  entityType: "opportunity" | "account" | "contact";
  entityId: string;
  organizationId: string;
  pageContext: string;
  userId?: string; // Current user ID for color coding "yours"
}

export const CommentScrollbarMarkers = ({
  entityType,
  entityId,
  organizationId,
  pageContext,
  userId,
}: CommentScrollbarMarkersProps) => {
  const { positions, documentHeight, scrollToComment } = useCommentPositions({ enabled: true });
  const { comments } = useComments({
    entityType,
    entityId,
    organizationId,
    pageContext,
  });
  const { openSidebar, selectComment } = useCommentSidebar();

  // Create a map of comment ID to comment data
  const commentMap = useMemo(() => {
    const map = new Map<string, Comment>();
    comments.forEach((comment) => {
      map.set(comment.id, comment);
    });
    return map;
  }, [comments]);

  // Calculate marker positions and properties
  const markers = useMemo(() => {
    return positions.map((position) => {
      const comment = commentMap.get(position.commentId);
      if (!comment) return null;

      // Calculate vertical position as percentage of viewport
      // This maps document position to scrollbar position
      const topPercentage = documentHeight > 0
        ? (position.top / documentHeight) * 100
        : 0;

      // Determine color based on status and ownership
      let colorClass = "bg-yellow-500"; // Default: unresolved
      if (position.isResolved) {
        colorClass = "bg-gray-400"; // Resolved
      } else if (userId && position.authorId === userId) {
        colorClass = "bg-blue-500"; // User's own
      }

      // Count replies
      const replyCount = comment.replies?.length || 0;

      return {
        commentId: position.commentId,
        topPercentage,
        colorClass,
        comment,
        replyCount,
        isResolved: position.isResolved,
        selectedText: comment.selectedText,
      };
    }).filter(Boolean);
  }, [positions, commentMap, documentHeight, userId]);

  const handleMarkerClick = (commentId: string) => {
    // Scroll to the highlighted text
    scrollToComment(commentId);

    // Open sidebar and set active comment
    openSidebar(entityType, entityId, pageContext);
    selectComment(commentId);
  };

  if (markers.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div
        className="comment-scrollbar-markers fixed right-0 top-0 w-4 h-screen pointer-events-none z-30"
        aria-label="Comment position indicators"
      >
        {markers.map((marker) => {
          if (!marker) return null;

          const { commentId, topPercentage, colorClass, comment, replyCount, isResolved, selectedText } = marker;

          // Position the marker on the scrollbar
          const markerStyle: React.CSSProperties = {
            position: 'absolute',
            top: `${topPercentage}%`,
            right: '0',
            width: '8px',
            height: '3px',
            transform: 'translateY(-50%)',
          };

          return (
            <Tooltip key={commentId}>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "comment-scrollbar-marker",
                    "pointer-events-auto",
                    "cursor-pointer",
                    "rounded-sm",
                    "transition-all duration-200",
                    "hover:scale-x-150 hover:w-3",
                    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
                    colorClass
                  )}
                  style={markerStyle}
                  onClick={() => handleMarkerClick(commentId)}
                  aria-label={`Jump to comment by ${comment.author?.name || 'Unknown'}`}
                />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-1">
                  <div className="font-semibold text-sm">
                    {comment.author?.name || 'Unknown'}
                    {isResolved && <span className="ml-2 text-xs text-muted-foreground">(Resolved)</span>}
                  </div>
                  <p className="text-sm line-clamp-2">{comment.content}</p>
                  {selectedText && (
                    <p className="text-xs text-muted-foreground italic line-clamp-1">
                      On: &ldquo;{selectedText}&rdquo;
                    </p>
                  )}
                  {replyCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Click to jump to comment
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
