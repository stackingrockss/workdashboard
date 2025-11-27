// src/hooks/useCommentActions.ts
// Shared hook for comment CRUD operations (create, update, delete, resolve, react)
// Eliminates duplicate API handler logic across InlineCommentPopover and CommentSheet

"use client";

import { useCallback } from "react";
import { toast } from "sonner";

interface UseCommentActionsProps {
  entityType: string;
  entityId: string;
  refetch: () => void;
}

export function useCommentActions({
  entityType,
  entityId,
  refetch,
}: UseCommentActionsProps) {
  // Handle creating a reply
  const handleCreateReply = useCallback(
    async (parentId: string, content: string, mentionedUserIds: string[]) => {
      try {
        const response = await fetch("/api/v1/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            entityType,
            entityId,
            parentId,
            mentionedUserIds,
          }),
        });

        if (!response.ok) throw new Error("Failed to create reply");
        toast.success("Reply added");
        refetch();
      } catch (error) {
        toast.error("Failed to create reply");
        throw error;
      }
    },
    [entityType, entityId, refetch]
  );

  // Handle updating a comment
  const handleUpdateComment = useCallback(
    async (commentId: string, content: string, mentionedUserIds: string[]) => {
      try {
        const response = await fetch(`/api/v1/comments/${commentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, mentionedUserIds }),
        });

        if (!response.ok) throw new Error("Failed to update comment");
        toast.success("Comment updated");
        refetch();
      } catch (error) {
        toast.error("Failed to update comment");
        throw error;
      }
    },
    [refetch]
  );

  // Handle deleting a comment
  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      try {
        const response = await fetch(`/api/v1/comments/${commentId}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete comment");
        toast.success("Comment deleted");
        refetch();
      } catch (error) {
        toast.error("Failed to delete comment");
        throw error;
      }
    },
    [refetch]
  );

  // Handle resolving/unresolving a comment
  const handleResolveComment = useCallback(
    async (commentId: string, isResolved: boolean) => {
      try {
        const response = await fetch(`/api/v1/comments/${commentId}/resolve`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isResolved }),
        });

        if (!response.ok) throw new Error("Failed to resolve comment");
        toast.success(isResolved ? "Comment resolved" : "Comment reopened");
        refetch();
      } catch (error) {
        toast.error("Failed to resolve comment");
        throw error;
      }
    },
    [refetch]
  );

  // Handle toggling reaction
  const handleToggleReaction = useCallback(
    async (commentId: string, emoji: string) => {
      try {
        const response = await fetch(`/api/v1/comments/${commentId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });

        if (!response.ok) throw new Error("Failed to toggle reaction");
        refetch();
      } catch (error) {
        toast.error("Failed to add reaction");
        throw error;
      }
    },
    [refetch]
  );

  return {
    handleCreateReply,
    handleUpdateComment,
    handleDeleteComment,
    handleResolveComment,
    handleToggleReaction,
  };
}
