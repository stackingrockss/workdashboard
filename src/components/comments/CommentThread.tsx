// src/components/comments/CommentThread.tsx
// Displays a comment with its replies and handles reply functionality

"use client";

import { useState } from "react";
import { Comment } from "./useComments";
import { CommentCard } from "./CommentCard";
import { CommentInput } from "./CommentInput";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface CommentThreadProps {
  comment: Comment;
  currentUserId: string;
  currentUserRole: "ADMIN" | "MANAGER" | "REP" | "VIEWER";
  availableUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }>;
  onCreateReply: (parentId: string, content: string, mentionedUserIds: string[]) => Promise<void>;
  onUpdate: (commentId: string, content: string, mentionedUserIds: string[]) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onResolve: (commentId: string, isResolved: boolean) => Promise<void>;
  onReact: (commentId: string, emoji: string) => Promise<void>;
}

export function CommentThread({
  comment,
  currentUserId,
  currentUserRole,
  availableUsers,
  onCreateReply,
  onUpdate,
  onDelete,
  onResolve,
  onReact,
}: CommentThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const handleReplySubmit = async (content: string, mentionedUserIds: string[]) => {
    await onCreateReply(comment.id, content, mentionedUserIds);
    setShowReplyInput(false);
  };

  const handleReplyClick = () => {
    setShowReplyInput(true);
    setShowReplies(true);
  };

  return (
    <div className="border-b last:border-b-0 pb-4 last:pb-0">
      {/* Parent comment */}
      <CommentCard
        comment={comment}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        availableUsers={availableUsers}
        onResolve={onResolve}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onReact={onReact}
        onReply={handleReplyClick}
        showReplyButton={true}
        isReply={false}
      />

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReplies(!showReplies)}
            className="mb-2 h-7 px-2 text-muted-foreground"
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            {showReplies ? "Hide" : "Show"} {comment.replies.length}{" "}
            {comment.replies.length === 1 ? "reply" : "replies"}
          </Button>

          {showReplies && (
            <div className="space-y-2">
              {comment.replies.map((reply) => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  availableUsers={availableUsers}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onReact={onReact}
                  showReplyButton={false}
                  isReply={true}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput && (
        <div className="ml-10 mt-3">
          <CommentInput
            placeholder="Write a reply..."
            onSubmit={handleReplySubmit}
            availableUsers={availableUsers}
            autoFocus
            submitButtonText="Reply"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReplyInput(false)}
            className="mt-2"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
