// src/components/notifications/AccountResearchNotificationItem.tsx
// Individual notification item for account research complete

"use client";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { AccountResearchNotification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

interface AccountResearchNotificationItemProps {
  notification: AccountResearchNotification;
  onClick: () => void;
}

export function AccountResearchNotificationItem({
  notification,
  onClick,
}: AccountResearchNotificationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <Button
      variant="ghost"
      className="w-full justify-start h-auto p-3 hover:bg-accent"
      onClick={onClick}
    >
      <div className="flex gap-3 w-full text-left">
        {/* Icon */}
        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>

        {/* Notification Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-medium leading-none">
              Account research ready
            </p>
            {!notification.isRead && (
              <div className="h-2 w-2 bg-amber-500 rounded-full flex-shrink-0 mt-1" />
            )}
          </div>

          {/* Account Name */}
          <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
            {notification.accountName}
          </p>

          {/* Opportunity Name */}
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            {notification.opportunityName}
          </p>

          {/* Footer: Timestamp */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
    </Button>
  );
}
