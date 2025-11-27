// src/components/comments/InlineCommentPopover.tsx
// Desktop popover for displaying comment threads inline next to highlighted text

"use client";

import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { CommentThread } from "./CommentThread";
import { useComments } from "./useComments";
import { useCommentActions } from "@/hooks/useCommentActions";
import { calculateOptimalPosition } from "@/lib/comments/positioning";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InlineCommentPopoverProps {
  commentId: string;
  isOpen: boolean;
  onClose: () => void;
  anchorElement: HTMLElement | null;
  entityType: string;
  entityId: string;
  organizationId: string;
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

const POPOVER_WIDTH = 360;
const POPOVER_MAX_HEIGHT = 500;

export function InlineCommentPopover({
  commentId,
  isOpen,
  onClose,
  anchorElement,
  entityType,
  entityId,
  organizationId,
  currentUser,
  organizationUsers,
}: InlineCommentPopoverProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  // Fetch comments data
  const { comments, isLoading, refetch } = useComments({
    entityType,
    entityId,
    organizationId,
  });

  // Use shared comment actions hook
  const {
    handleCreateReply,
    handleUpdateComment,
    handleDeleteComment,
    handleResolveComment,
    handleToggleReaction,
  } = useCommentActions({ entityType, entityId, refetch });

  // Find the specific comment for this popover
  const comment = useMemo(() => {
    return comments.find((c) => c.id === commentId);
  }, [comments, commentId]);

  // Calculate position when anchor element or open state changes
  useEffect(() => {
    if (!isOpen || !anchorElement) {
      setPosition(null);
      return;
    }

    const calculatePosition = () => {
      const highlightRect = anchorElement.getBoundingClientRect();
      const optimalPosition = calculateOptimalPosition(highlightRect, {
        width: POPOVER_WIDTH,
        height: POPOVER_MAX_HEIGHT,
      });

      setPosition({ x: optimalPosition.x, y: optimalPosition.y });
    };

    calculatePosition();

    // Recalculate on scroll (close if highlight goes offscreen)
    const handleScroll = () => {
      const rect = anchorElement.getBoundingClientRect();

      // Close if highlight is offscreen
      if (rect.top < 0 || rect.top > window.innerHeight) {
        onClose();
      } else {
        calculatePosition();
      }
    };

    // Debounced resize handler
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(calculatePosition, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [isOpen, anchorElement, onClose]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !comment || !position) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverContent
        side="right"
        align="start"
        className="w-[360px] max-h-[500px] overflow-y-auto p-0"
        style={{
          position: "absolute",
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comment-thread-title"
        onOpenAutoFocus={(e) => {
          // Don't auto-focus, keep focus on page
          e.preventDefault();
        }}
      >
        {/* Header with close button */}
        <div className="sticky top-0 bg-background border-b px-4 py-2 flex items-center justify-between z-10">
          <h3 id="comment-thread-title" className="text-sm font-medium">Comment Thread</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
            aria-label="Close comment"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Comment thread */}
        <div className="p-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <CommentThread
              comment={comment}
              currentUserId={currentUser.id}
              currentUserRole={currentUser.role}
              availableUsers={organizationUsers}
              onCreateReply={handleCreateReply}
              onUpdate={handleUpdateComment}
              onDelete={handleDeleteComment}
              onResolve={handleResolveComment}
              onReact={handleToggleReaction}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
