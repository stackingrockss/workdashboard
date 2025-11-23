// src/components/notifications/MentionNotificationItem.tsx
// Individual notification item for comment mentions

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

interface MentionNotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

export function MentionNotificationItem({
  notification,
  onClick,
}: MentionNotificationItemProps) {
  const { comment } = notification;
  const authorName = comment.author.name || comment.author.email;
  const authorInitials = authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Truncate comment content for preview
  const previewText = comment.content.length > 80
    ? comment.content.slice(0, 80) + "..."
    : comment.content;

  // Format timestamp
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
    addSuffix: true,
  });

  return (
    <Button
      variant="ghost"
      className="w-full justify-start h-auto p-3 hover:bg-accent"
      onClick={onClick}
    >
      <div className="flex gap-3 w-full text-left">
        {/* Author Avatar */}
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={comment.author.avatarUrl || undefined} />
          <AvatarFallback>{authorInitials}</AvatarFallback>
        </Avatar>

        {/* Notification Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-medium leading-none">
              {authorName} mentioned you
            </p>
            {!notification.isRead && (
              <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
            )}
          </div>

          {/* Comment Preview */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
            {previewText}
          </p>

          {/* Timestamp */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
    </Button>
  );
}
