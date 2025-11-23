// src/hooks/useNotifications.ts
// Custom hook for fetching and managing user notifications (comment mentions)

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { logError, getErrorMessage } from "@/lib/errors";

export interface NotificationComment {
  id: string;
  content: string;
  entityType: string;
  entityId: string;
  pageContext: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

export interface Notification {
  id: string;
  commentId: string;
  comment: NotificationComment;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

interface UseNotificationsOptions {
  enabled?: boolean;
  pollingInterval?: number; // in milliseconds
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, pollingInterval = 30000 } = options; // Poll every 30 seconds
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      const response = await fetch("/api/v1/notifications/mentions?limit=10&includeRead=false");

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      logError("fetch-notifications", err);
      setError(getErrorMessage(err, "Failed to fetch notifications"));
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  // Mark specific notifications as read
  const markAsRead = useCallback(
    async (mentionIds: string[]) => {
      try {
        const response = await fetch("/api/v1/notifications/mentions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mentionIds }),
        });

        if (!response.ok) {
          throw new Error("Failed to mark notifications as read");
        }

        // Update local state
        setNotifications((prev) =>
          prev.filter((notification) => !mentionIds.includes(notification.id))
        );
        setUnreadCount((prev) => Math.max(0, prev - mentionIds.length));

        return true;
      } catch (err) {
        logError("mark-notifications-read", err);
        return false;
      }
    },
    []
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const allMentionIds = notifications.map((n) => n.id);
    if (allMentionIds.length === 0) return true;
    return markAsRead(allMentionIds);
  }, [notifications, markAsRead]);

  // Navigate to notification's comment and mark as read
  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      // Mark as read
      await markAsRead([notification.id]);

      // Navigate to the comment
      const { entityType, entityId, pageContext } = notification.comment;

      // Construct URL based on entity type
      let url = pageContext || `/${entityType}s/${entityId}`;

      // Add comment hash to scroll to it
      url += `#comment-${notification.commentId}`;

      router.push(url);
    },
    [markAsRead, router]
  );

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchNotifications();
    }
  }, [enabled, fetchNotifications]);

  // Polling for new notifications
  useEffect(() => {
    if (!enabled || !pollingInterval) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [enabled, pollingInterval, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    handleNotificationClick,
    refetch: fetchNotifications,
  };
}
