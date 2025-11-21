// src/components/comments/useComments.ts
// Custom hook for fetching and subscribing to comments with Supabase Realtime

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { subscribeToComments } from "@/lib/realtime";

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  pageContext: string | null;
  selectionType: string | null;
  anchorSelector: string | null;
  anchorOffset: number | null;
  focusSelector: string | null;
  focusOffset: number | null;
  selectedText: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedById: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  author: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  resolvedBy?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  replies: Comment[];
  mentions: {
    id: string;
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  }[];
  reactions: {
    id: string;
    emoji: string;
    userId: string;
    user: {
      id: string;
      name: string | null;
    };
  }[];
}

interface UseCommentsOptions {
  entityType: string | null;
  entityId: string | null;
  organizationId: string | null;
  includeResolved?: boolean;
  pageContext?: string | null;
  enabled?: boolean;
}

export function useComments({
  entityType,
  entityId,
  organizationId,
  includeResolved = true,
  pageContext,
  enabled = true,
}: UseCommentsOptions) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Fetch comments from API
  const fetchComments = useCallback(async () => {
    if (!entityType || !entityId || !enabled) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        entityType,
        entityId,
        includeResolved: includeResolved.toString(),
      });

      if (pageContext) {
        params.append("pageContext", pageContext);
      }

      const response = await fetch(`/api/v1/comments?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }

      const data = await response.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error("Error fetching comments:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch comments");
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId, includeResolved, pageContext, enabled]);

  // Real-time subscription with Supabase Realtime
  useEffect(() => {
    if (!entityType || !entityId || !organizationId || !enabled) {
      return;
    }

    // Initial fetch
    fetchComments();

    // Subscribe to real-time updates
    const { unsubscribe } = subscribeToComments<Comment, Comment['reactions'][number]>(
      organizationId,
      entityType,
      entityId,
      {
        onCommentCreated: (newComment) => {
          console.log("[Realtime] Comment created:", newComment.id);
          setComments((prev) => {
            // Check if comment already exists (prevent duplicates)
            if (prev.some((c) => c.id === newComment.id)) {
              return prev;
            }
            // Add to appropriate location based on parentId
            if (newComment.parentId) {
              // It's a reply - add to parent's replies array
              return prev.map((comment) => {
                if (comment.id === newComment.parentId) {
                  return {
                    ...comment,
                    replies: [...comment.replies, newComment],
                  };
                }
                return comment;
              });
            }
            // It's a parent comment - add to top level
            return [...prev, newComment].sort(
              (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        },
        onCommentUpdated: (updatedComment) => {
          console.log("[Realtime] Comment updated:", updatedComment.id);
          setComments((prev) =>
            prev.map((comment) => {
              if (comment.id === updatedComment.id) {
                return updatedComment;
              }
              // Check if it's a reply within this comment
              if (comment.replies.some((r) => r.id === updatedComment.id)) {
                return {
                  ...comment,
                  replies: comment.replies.map((r) =>
                    r.id === updatedComment.id ? updatedComment : r
                  ),
                };
              }
              return comment;
            })
          );
        },
        onCommentDeleted: (commentId) => {
          console.log("[Realtime] Comment deleted:", commentId);
          setComments((prev) =>
            prev
              .filter((c) => c.id !== commentId)
              .map((comment) => ({
                ...comment,
                replies: comment.replies.filter((r) => r.id !== commentId),
              }))
          );
        },
        onCommentResolved: ({ commentId, isResolved }) => {
          console.log("[Realtime] Comment resolved:", commentId, isResolved);
          setComments((prev) =>
            prev.map((comment) => {
              if (comment.id === commentId) {
                return { ...comment, isResolved };
              }
              return comment;
            })
          );
        },
        onReactionToggled: ({ commentId, reaction, action }) => {
          console.log("[Realtime] Reaction toggled:", commentId, action);
          setComments((prev) =>
            prev.map((comment) => {
              if (comment.id === commentId) {
                const reactions = [...comment.reactions];
                if (action === "added") {
                  reactions.push(reaction);
                } else {
                  const index = reactions.findIndex((r) => r.id === reaction.id);
                  if (index > -1) {
                    reactions.splice(index, 1);
                  }
                }
                return { ...comment, reactions };
              }
              // Check replies
              if (comment.replies.some((r) => r.id === commentId)) {
                return {
                  ...comment,
                  replies: comment.replies.map((r) => {
                    if (r.id === commentId) {
                      const reactions = [...r.reactions];
                      if (action === "added") {
                        reactions.push(reaction);
                      } else {
                        const index = reactions.findIndex(
                          (rx) => rx.id === reaction.id
                        );
                        if (index > -1) {
                          reactions.splice(index, 1);
                        }
                      }
                      return { ...r, reactions };
                    }
                    return r;
                  }),
                };
              }
              return comment;
            })
          );
        },
        onConnected: () => {
          console.log("[Realtime] Connected");
          setIsConnected(true);
          setError(null);
        },
        onDisconnected: () => {
          console.log("[Realtime] Disconnected");
          setIsConnected(false);
        },
        onError: (err) => {
          console.error("[Realtime] Error:", err);
          setError("Real-time connection failed");
          setIsConnected(false);
        },
      }
    );

    unsubscribeRef.current = unsubscribe;

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [entityType, entityId, organizationId, enabled, fetchComments]);

  return {
    comments,
    isLoading,
    error,
    isConnected,
    refetch: fetchComments,
  };
}
