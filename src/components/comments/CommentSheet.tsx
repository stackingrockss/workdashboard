// src/components/comments/CommentSheet.tsx
// Mobile-optimized bottom sheet for displaying comment threads

"use client";

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CommentThread } from "./CommentThread";
import { useComments } from "./useComments";
import { useCommentActions } from "@/hooks/useCommentActions";

interface CommentSheetProps {
  commentId: string;
  isOpen: boolean;
  onClose: () => void;
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

export function CommentSheet({
  commentId,
  isOpen,
  onClose,
  entityType,
  entityId,
  organizationId,
  currentUser,
  organizationUsers,
}: CommentSheetProps) {
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

  // Find the specific comment for this sheet
  const comment = useMemo(() => {
    return comments.find((c) => c.id === commentId);
  }, [comments, commentId]);

  if (!comment) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[70vh] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          // Prevent auto-focus stealing
          e.preventDefault();
        }}
      >
        <SheetHeader>
          <SheetTitle>Comment Thread</SheetTitle>
          {comment.selectedText && (
            <SheetDescription className="mt-2 p-2 bg-muted/50 border-l-2 border-primary/50 rounded text-sm italic">
              &ldquo;{comment.selectedText}&rdquo;
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6">
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
      </SheetContent>
    </Sheet>
  );
}
