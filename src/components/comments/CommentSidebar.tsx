// src/components/comments/CommentSidebar.tsx
// Main sidebar component for displaying and managing comments

"use client";

import { useState, useEffect } from "react";
import { useCommentSidebar } from "./CommentSidebarContext";
import { useComments } from "./useComments";
import { CommentThread } from "./CommentThread";
import { CommentInput } from "./CommentInput";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  X,
  MessageSquare,
  Filter,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface CommentSidebarProps {
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

export function CommentSidebar({ currentUser, organizationUsers }: CommentSidebarProps) {
  const { isOpen, entityType, entityId, pageContext, closeSidebar, selectedCommentId } =
    useCommentSidebar();
  const [includeResolved, setIncludeResolved] = useState(false);
  const [textSelection, setTextSelection] = useState<{
    selectionType: "text" | "element";
    anchorSelector: string;
    anchorOffset: number;
    focusSelector: string;
    focusOffset: number;
    selectedText: string;
  } | null>(null);

  const { comments, isLoading, error, isConnected, refetch } = useComments({
    entityType,
    entityId,
    organizationId: currentUser.organizationId,
    includeResolved,
    pageContext: pageContext || undefined,
    enabled: isOpen && !!entityType && !!entityId,
  });

  // Handle creating a new comment
  const handleCreateComment = async (content: string, mentionedUserIds: string[]) => {
    if (!entityType || !entityId) return;

    try {
      const response = await fetch("/api/v1/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          entityType,
          entityId,
          pageContext: pageContext || undefined,
          textSelection,
          mentionedUserIds,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create comment");
      }

      // Clear text selection after creating comment
      setTextSelection(null);
      refetch();
    } catch (error) {
      console.error("Error creating comment:", error);
      throw error;
    }
  };

  // Handle creating a reply
  const handleCreateReply = async (
    parentId: string,
    content: string,
    mentionedUserIds: string[]
  ) => {
    if (!entityType || !entityId) return;

    try {
      const response = await fetch("/api/v1/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          entityType,
          entityId,
          pageContext: pageContext || undefined,
          parentId,
          mentionedUserIds,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create reply");
      }

      refetch();
    } catch (error) {
      console.error("Error creating reply:", error);
      throw error;
    }
  };

  // Handle updating a comment
  const handleUpdateComment = async (
    commentId: string,
    content: string,
    mentionedUserIds: string[]
  ) => {
    try {
      const response = await fetch(`/api/v1/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mentionedUserIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to update comment");
      }

      refetch();
    } catch (error) {
      console.error("Error updating comment:", error);
      throw error;
    }
  };

  // Handle deleting a comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      const response = await fetch(`/api/v1/comments/${commentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      refetch();
    } catch (error) {
      console.error("Error deleting comment:", error);
      throw error;
    }
  };

  // Handle resolving a comment
  const handleResolveComment = async (commentId: string, isResolved: boolean) => {
    try {
      const response = await fetch(`/api/v1/comments/${commentId}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isResolved }),
      });

      if (!response.ok) {
        throw new Error("Failed to resolve comment");
      }

      refetch();
    } catch (error) {
      console.error("Error resolving comment:", error);
      throw error;
    }
  };

  // Handle adding/removing reaction
  const handleReactToComment = async (commentId: string, emoji: string) => {
    try {
      const response = await fetch(`/api/v1/comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error("Failed to add reaction");
      }

      refetch();
    } catch (error) {
      console.error("Error adding reaction:", error);
      throw error;
    }
  };

  // Scroll to selected comment
  useEffect(() => {
    if (selectedCommentId) {
      const element = document.getElementById(`comment-${selectedCommentId}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedCommentId]);

  if (!isOpen) return null;

  const unresolvedCount = comments.filter((c) => !c.isResolved).length;
  const resolvedCount = comments.filter((c) => c.isResolved).length;

  return (
    <aside className="fixed right-0 top-0 h-screen w-96 border-l bg-background shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h2 className="font-semibold">Comments</h2>
          <Badge variant="secondary" className="ml-2">
            {unresolvedCount}
          </Badge>
          {/* Connection status indicator */}
          {isConnected ? (
            <Badge variant="outline" className="ml-1 bg-green-50 text-green-700 border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
              Live
            </Badge>
          ) : error ? (
            <Badge variant="outline" className="ml-1 bg-red-50 text-red-700 border-red-200">
              Offline
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-1 bg-yellow-50 text-yellow-700 border-yellow-200">
              Connecting...
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={includeResolved}
                onCheckedChange={setIncludeResolved}
              >
                Show resolved ({resolvedCount})
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={closeSidebar}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isLoading ? (
            // Loading state
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-20 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="text-center py-8">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={refetch} className="mt-4">
                Try again
              </Button>
            </div>
          ) : comments.length === 0 ? (
            // Empty state
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No comments yet. Be the first to comment!
              </p>
            </div>
          ) : (
            // Comments
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} id={`comment-${comment.id}`}>
                  <CommentThread
                    comment={comment}
                    currentUserId={currentUser.id}
                    currentUserRole={currentUser.role}
                    availableUsers={organizationUsers}
                    onCreateReply={handleCreateReply}
                    onUpdate={handleUpdateComment}
                    onDelete={handleDeleteComment}
                    onResolve={handleResolveComment}
                    onReact={handleReactToComment}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* New comment input */}
      {currentUser.role !== "VIEWER" && (
        <div className="p-4 border-t">
          {textSelection && (
            <div className="mb-2 p-2 bg-primary/10 border-l-2 border-primary rounded text-sm">
              <div className="font-medium text-xs text-muted-foreground mb-1">
                Commenting on:
              </div>
              <div className="italic">"{textSelection.selectedText}"</div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-6 px-2"
                onClick={() => setTextSelection(null)}
              >
                <X className="h-3 w-3 mr-1" />
                Clear selection
              </Button>
            </div>
          )}
          <CommentInput
            placeholder={
              textSelection
                ? "Comment on this selection..."
                : "Add a comment... Use @ to mention someone"
            }
            onSubmit={handleCreateComment}
            availableUsers={organizationUsers}
          />
        </div>
      )}
    </aside>
  );
}
