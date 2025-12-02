// src/components/notifications/ContactNotificationItem.tsx
// Individual notification item for contacts ready to import

"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Phone, FileText } from "lucide-react";
import { ContactsReadyNotification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

interface ContactNotificationItemProps {
  notification: ContactsReadyNotification;
  onClick: () => void;
}

export function ContactNotificationItem({
  notification,
  onClick,
}: ContactNotificationItemProps) {
  const isGongCall = !!notification.gongCallId;
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
        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
          <UserPlus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>

        {/* Notification Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-medium leading-none">
              {notification.contactCount} contact{notification.contactCount !== 1 ? "s" : ""} ready to import
            </p>
            {!notification.isRead && (
              <div className="h-2 w-2 bg-purple-500 rounded-full flex-shrink-0 mt-1" />
            )}
          </div>

          {/* Call/Note Title */}
          <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
            From &quot;{notification.callTitle}&quot;
          </p>

          {/* Opportunity Name */}
          <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
            {notification.opportunityName}
          </p>

          {/* Footer: Source type and timestamp */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="h-5 px-1.5 text-xs font-normal">
              {isGongCall ? (
                <>
                  <Phone className="h-3 w-3 mr-1" />
                  Gong
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3 mr-1" />
                  Granola
                </>
              )}
            </Badge>
            <span>•</span>
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
    </Button>
  );
}
