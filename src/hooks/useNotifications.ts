// src/hooks/useNotifications.ts
// Custom hook for fetching and managing user notifications (comment mentions)

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { logError, getErrorMessage } from "@/lib/errors";
import { subscribeToNotifications } from "@/lib/realtime";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  enableRealtime?: boolean; // Enable WebSocket-based real-time updates
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, pollingInterval = 30000, enableRealtime = true } = options;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false); // WebSocket connection status
  const router = useRouter();

  // Store channel reference and userId for real-time subscription
  const channelRef = useRef<RealtimeChannel | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      const response = await fetch("/api/v1/notifications/mentions?limit=10&includeRead=false");

      if (response.status === 401) {
        // Session expired, redirect to login
        window.location.href = "/auth/login";
        return;
      }

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

  // Fetch userId from API for real-time subscription
  useEffect(() => {
    if (!enabled || !enableRealtime) return;

    const fetchUserId = async () => {
      try {
        const response = await fetch("/api/v1/users/me");
        if (response.status === 401) {
          // Session expired, redirect to login
          window.location.href = "/auth/login";
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to fetch user ID");
        }
        const data = await response.json();
        setUserId(data.id);
      } catch (err) {
        logError("fetch-user-id", err);
        // Continue without real-time if user fetch fails
      }
    };

    fetchUserId();
  }, [enabled, enableRealtime]);

  // Fetch single notification by mention ID (for optimistic updates)
  const fetchNotificationByMentionId = useCallback(async (mentionId: string) => {
    try {
      const response = await fetch("/api/v1/notifications/mentions?limit=20&includeRead=false");
      if (!response.ok) return null;

      const data = await response.json();
      const newNotification = data.notifications.find((n: Notification) => n.id === mentionId);
      return newNotification || null;
    } catch (err) {
      logError("fetch-single-notification", err);
      return null;
    }
  }, []);

  // Handle real-time mention event
  const handleMentionCreated = useCallback(
    async (data: { mentionId: string; commentId: string }) => {
      // Optimistically increment unread count
      setUnreadCount((prev) => prev + 1);

      // Fetch the full notification data
      const newNotification = await fetchNotificationByMentionId(data.mentionId);

      if (newNotification) {
        // Add to notification list
        setNotifications((prev) => [newNotification, ...prev]);

        // Show toast notification
        const authorName =
          newNotification.comment.author.name || newNotification.comment.author.email;
        toast.info(`${authorName} mentioned you`, {
          description: newNotification.comment.content.slice(0, 60) + "...",
          action: {
            label: "View",
            onClick: () => {
              handleNotificationClick(newNotification);
            },
          },
          duration: 5000,
        });
      } else {
        // Fallback: refetch all notifications if we can't get the specific one
        await fetchNotifications();
      }
    },
    [fetchNotificationByMentionId, fetchNotifications]
  );

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

  // Set up real-time subscription
  useEffect(() => {
    if (!enabled || !enableRealtime || !userId) {
      return;
    }

    // Subscribe to notification events
    const { channel, unsubscribe } = subscribeToNotifications(userId, {
      onMentionCreated: handleMentionCreated,
      onConnected: () => {
        setIsConnected(true);
        console.log("✅ Real-time notifications connected");
      },
      onDisconnected: () => {
        setIsConnected(false);
        console.log("⚠️ Real-time notifications disconnected");
      },
      onError: (error) => {
        logError("realtime-subscription", error);
        setIsConnected(false);
        // Continue with polling fallback
      },
    });

    channelRef.current = channel;
    unsubscribeRef.current = unsubscribe;

    // Cleanup on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [enabled, enableRealtime, userId, handleMentionCreated]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchNotifications();
    }
  }, [enabled, fetchNotifications]);

  // Polling for new notifications (fallback and data integrity check)
  useEffect(() => {
    if (!enabled || !pollingInterval) return;

    // If real-time is enabled and connected, reduce polling frequency
    const effectiveInterval =
      enableRealtime && isConnected
        ? pollingInterval * 4 // Poll every 2 minutes instead of 30 seconds
        : pollingInterval;

    const interval = setInterval(() => {
      fetchNotifications();
    }, effectiveInterval);

    return () => clearInterval(interval);
  }, [enabled, pollingInterval, enableRealtime, isConnected, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    isConnected, // WebSocket connection status
    markAsRead,
    markAllAsRead,
    handleNotificationClick,
    refetch: fetchNotifications,
  };
}
