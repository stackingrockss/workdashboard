// src/components/comments/CommentCard.tsx
// Individual comment card with reactions, edit, delete, and resolve functionality

"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { RichTextViewer } from "@/components/ui/rich-text-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
  Smile,
} from "lucide-react";
import { toast } from "sonner";
import { Comment } from "./useComments";
import { CommentInput } from "./CommentInput";

interface CommentCardProps {
  comment: Comment;
  currentUserId: string;
  currentUserRole: "ADMIN" | "MANAGER" | "REP" | "VIEWER";
  availableUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }>;
  onResolve?: (commentId: string, isResolved: boolean) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onUpdate?: (commentId: string, content: string, mentionedUserIds: string[]) => Promise<void>;
  onReact?: (commentId: string, emoji: string) => Promise<void>;
  onReply?: (commentId: string) => void;
  showReplyButton?: boolean;
  isReply?: boolean;
}

const COMMON_EMOJIS = ["👍", "❤️", "🎉", "😊", "👏", "🚀"];

export function CommentCard({
  comment,
  currentUserId,
  currentUserRole,
  availableUsers,
  onResolve,
  onDelete,
  onUpdate,
  onReact,
  onReply,
  showReplyButton = true,
  isReply = false,
}: CommentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isAuthor = comment.authorId === currentUserId;
  const canEdit = isAuthor || currentUserRole === "ADMIN";
  const canDelete = isAuthor || currentUserRole === "ADMIN";
  const canResolve = !isReply && (isAuthor || currentUserRole === "ADMIN" || currentUserRole === "MANAGER");

  // Group reactions by emoji
  const reactionGroups = comment.reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, typeof comment.reactions>);

  // Check if current user has reacted with specific emoji
  const hasUserReacted = (emoji: string) => {
    return comment.reactions.some(
      (r) => r.emoji === emoji && r.userId === currentUserId
    );
  };

  // Handle reaction toggle
  const handleReaction = async (emoji: string) => {
    if (!onReact) return;
    try {
      await onReact(comment.id, emoji);
    } catch (error) {
      toast.error("Failed to add reaction");
    }
  };

  // Handle resolve toggle
  const handleResolve = async () => {
    if (!onResolve) return;
    try {
      await onResolve(comment.id, !comment.isResolved);
      toast.success(comment.isResolved ? "Comment reopened" : "Comment resolved");
    } catch (error) {
      toast.error("Failed to update comment");
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      await onDelete(comment.id);
      toast.success("Comment deleted");
    } catch (error) {
      toast.error("Failed to delete comment");
    }
  };

  // Handle edit submit
  const handleEditSubmit = async (content: string, mentionedUserIds: string[]) => {
    if (!onUpdate) return;
    try {
      await onUpdate(comment.id, content, mentionedUserIds);
      setIsEditing(false);
      toast.success("Comment updated");
    } catch (error) {
      toast.error("Failed to update comment");
    }
  };

  // Render mention links in markdown
  const renderMention = (text: string) => {
    return text.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, (match, name) => {
      return `<span class="mention bg-primary/10 text-primary px-1 rounded">@${name}</span>`;
    });
  };

  return (
    <div className={`group relative ${isReply ? "ml-10 mt-2" : "mt-4"}`}>
      <div
        className={`rounded-lg border p-4 ${
          comment.isResolved ? "bg-muted/50 opacity-75" : "bg-background"
        } ${isReply ? "border-l-2 border-l-primary/20" : ""}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={comment.author.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {(comment.author.name || comment.author.email).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium">
                {comment.author.name || comment.author.email}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                {comment.editedAt && " (edited)"}
              </div>
            </div>
            {comment.isResolved && (
              <Badge variant="secondary" className="ml-2">
                <Check className="h-3 w-3 mr-1" />
                Resolved
              </Badge>
            )}
          </div>

          {/* Actions menu */}
          {(canEdit || canDelete || canResolve) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canResolve && (
                  <DropdownMenuItem onClick={handleResolve}>
                    {comment.isResolved ? (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Reopen
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Resolve
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Selected text quote (if inline comment) */}
        {comment.selectedText && (
          <div className="mb-2 p-2 bg-muted/50 border-l-2 border-primary/50 rounded text-sm italic">
            &ldquo;{comment.selectedText}&rdquo;
          </div>
        )}

        {/* Content */}
        {isEditing ? (
          <div className="mt-2">
            <CommentInput
              initialValue={comment.content}
              onSubmit={handleEditSubmit}
              availableUsers={availableUsers}
              autoFocus
              submitButtonText="Save"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
              className="mt-2"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <RichTextViewer content={comment.content} />
          </div>
        )}

        {/* Reactions */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {Object.entries(reactionGroups).map(([emoji, reactions]) => (
            <Button
              key={emoji}
              variant={hasUserReacted(emoji) ? "default" : "outline"}
              size="sm"
              className="h-7 px-2"
              onClick={() => handleReaction(emoji)}
            >
              <span className="mr-1">{emoji}</span>
              <span className="text-xs">{reactions.length}</span>
            </Button>
          ))}

          {/* Add reaction button */}
          <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="grid grid-cols-6 gap-1 p-2">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleReaction(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="text-2xl hover:bg-accent rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reply button */}
          {showReplyButton && !isReply && onReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 ml-auto"
              onClick={() => onReply(comment.id)}
            >
              Reply
            </Button>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the comment
              {comment.replies.length > 0 && ` and its ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
