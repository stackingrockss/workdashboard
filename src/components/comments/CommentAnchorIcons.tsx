// src/components/comments/CommentAnchorIcons.tsx
// Renders floating comment icons in the margin next to highlighted text (like Google Docs)

"use client";

import { MessageSquare } from "lucide-react";
import { useCommentPositions } from "@/hooks/useCommentPositions";
import { useComments, type Comment } from "./useComments";
import { useCommentSidebar } from "./CommentSidebarContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface CommentAnchorIconsProps {
  entityType: "opportunity" | "account" | "contact";
  entityId: string;
  organizationId: string;
  pageContext: string;
  userId?: string; // Current user ID for color coding "yours"
}

export const CommentAnchorIcons = ({
  entityType,
  entityId,
  organizationId,
  pageContext,
  userId,
}: CommentAnchorIconsProps) => {
  const { positions, scrollToComment } = useCommentPositions({ enabled: true });
  const { comments } = useComments({
    entityType,
    entityId,
    organizationId,
    pageContext,
  });
  const { openSidebar, selectComment } = useCommentSidebar();

  // Create a map of comment ID to comment data for quick lookup
  const commentMap = useMemo(() => {
    const map = new Map<string, Comment>();
    comments.forEach((comment) => {
      map.set(comment.id, comment);
    });
    return map;
  }, [comments]);

  // Group positions by commentId and get thread info
  const anchorData = useMemo(() => {
    return positions.map((position) => {
      const comment = commentMap.get(position.commentId);
      if (!comment) return null;

      // Count replies
      const replyCount = comment.replies?.length || 0;
      const totalCount = 1 + replyCount;

      // Determine color based on status and ownership
      let colorClass = "bg-yellow-400 hover:bg-yellow-500"; // Default: unresolved
      if (position.isResolved) {
        colorClass = "bg-gray-400 hover:bg-gray-500"; // Resolved
      } else if (userId && position.authorId === userId) {
        colorClass = "bg-blue-400 hover:bg-blue-500"; // User's own
      }

      return {
        ...position,
        comment,
        replyCount,
        totalCount,
        colorClass,
      };
    }).filter(Boolean);
  }, [positions, commentMap, userId]);

  const handleIconClick = (commentId: string) => {
    // Scroll to the highlighted text
    scrollToComment(commentId);

    // Open sidebar and set active comment
    openSidebar(entityType, entityId, pageContext);
    selectComment(commentId);
  };

  if (anchorData.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="comment-anchor-icons-container">
        {anchorData.map((anchor) => {
          if (!anchor) return null;

          const { commentId, top, comment, totalCount, colorClass, isResolved } = anchor;

          // Position the icon in the margin at the same vertical position as the highlight
          const iconStyle: React.CSSProperties = {
            position: 'absolute',
            top: `${top}px`,
            right: '-48px', // Position in right margin
            transform: 'translateY(-50%)',
            zIndex: 40,
          };

          return (
            <Tooltip key={commentId}>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "comment-anchor-icon",
                    "hidden md:flex items-center justify-center",
                    "w-8 h-8 rounded-full shadow-md",
                    "transition-all duration-200",
                    "hover:scale-110 hover:shadow-lg",
                    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
                    colorClass
                  )}
                  style={iconStyle}
                  onClick={() => handleIconClick(commentId)}
                  aria-label={`View comment by ${comment.author?.name || 'Unknown'}`}
                >
                  <MessageSquare className="w-4 h-4 text-white" />
                  {totalCount > 1 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
                    >
                      {totalCount}
                    </Badge>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <div className="space-y-1">
                  <div className="font-semibold text-sm">
                    {comment.author?.name || 'Unknown'}
                    {isResolved && <span className="ml-2 text-xs text-muted-foreground">(Resolved)</span>}
                  </div>
                  <p className="text-sm line-clamp-2">{comment.content}</p>
                  {comment.selectedText && (
                    <p className="text-xs text-muted-foreground italic line-clamp-1">
                      &ldquo;{comment.selectedText}&rdquo;
                    </p>
                  )}
                  {totalCount > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {anchor.replyCount} {anchor.replyCount === 1 ? 'reply' : 'replies'}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
