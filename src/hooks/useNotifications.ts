// src/hooks/useNotifications.ts
// Custom hook for fetching and managing user notifications (comment mentions + contact import)

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

// Mention notification (someone mentioned you in a comment)
export interface MentionNotification {
  id: string;
  type: "mention";
  commentId: string;
  comment: NotificationComment;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

// Contact import notification (contacts ready to import from parsed transcript)
export interface ContactsReadyNotification {
  id: string;
  type: "contacts_ready";
  contactCount: number;
  opportunityId: string;
  opportunityName: string;
  callTitle: string;
  gongCallId: string | null;
  granolaNoteId: string | null;
  parsedPeople: unknown; // JSON array of PersonExtracted
  meetingDate: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

// Parsing complete notification (transcript parsed, can view insights)
export interface ParsingCompleteNotification {
  id: string;
  type: "parsing_complete";
  opportunityId: string;
  opportunityName: string;
  callTitle: string;
  gongCallId: string | null;
  granolaNoteId: string | null;
  meetingDate: string | null;
  insights: {
    painPoints: string[];
    goals: string[];
    nextSteps: string[];
    people: unknown;
    riskAssessment: unknown;
  } | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

// Account research notification (AI research complete for new opportunity)
export interface AccountResearchNotification {
  id: string;
  type: "account_research";
  opportunityId: string;
  opportunityName: string;
  accountName: string;
  researchStatus: string | null;
  researchGeneratedAt: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

// Union type for all notification types
export type Notification = MentionNotification | ContactsReadyNotification | ParsingCompleteNotification | AccountResearchNotification;

// Legacy type for backward compatibility
export interface LegacyNotification {
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
  onContactsReadyClick?: (notification: ContactsReadyNotification) => void; // Handler for contact import clicks
  onParsingCompleteClick?: (notification: ParsingCompleteNotification) => void; // Handler for parsing complete clicks
  onAccountResearchClick?: (notification: AccountResearchNotification) => void; // Handler for account research clicks
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, pollingInterval = 30000, enableRealtime = true, onContactsReadyClick, onParsingCompleteClick, onAccountResearchClick } = options;
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

  // Fetch all notifications from all APIs
  const fetchNotifications = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Don't fetch on auth pages (prevents redirect loops)
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/auth")) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      // Fetch all notification types in parallel
      const [mentionsRes, contactsRes, parsingRes, researchRes] = await Promise.all([
        fetch("/api/v1/notifications/mentions?limit=10&includeRead=false"),
        fetch("/api/v1/notifications/contacts?limit=10&includeRead=false"),
        fetch("/api/v1/notifications/parsing-complete?limit=10&includeRead=false"),
        fetch("/api/v1/notifications/account-research?limit=10&includeRead=false"),
      ]);

      if (mentionsRes.status === 401 || contactsRes.status === 401 || parsingRes.status === 401 || researchRes.status === 401) {
        // Session expired - only redirect if not already on auth page
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth/login";
        }
        return;
      }

      const mentionsData = mentionsRes.ok ? await mentionsRes.json() : { notifications: [], unreadCount: 0 };
      const contactsData = contactsRes.ok ? await contactsRes.json() : { notifications: [], unreadCount: 0 };
      const parsingData = parsingRes.ok ? await parsingRes.json() : { notifications: [], unreadCount: 0 };
      const researchData = researchRes.ok ? await researchRes.json() : { notifications: [], unreadCount: 0 };

      // Transform mention notifications to include type
      const mentionNotifications: MentionNotification[] = (mentionsData.notifications || []).map(
        (n: LegacyNotification) => ({
          ...n,
          type: "mention" as const,
        })
      );

      // Contact notifications already have type from API
      const contactNotifications: ContactsReadyNotification[] = contactsData.notifications || [];

      // Parsing complete notifications already have type from API
      const parsingNotifications: ParsingCompleteNotification[] = parsingData.notifications || [];

      // Account research notifications already have type from API
      const researchNotifications: AccountResearchNotification[] = researchData.notifications || [];

      // Merge and sort by createdAt (newest first)
      const allNotifications: Notification[] = [...mentionNotifications, ...contactNotifications, ...parsingNotifications, ...researchNotifications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotifications(allNotifications);
      setUnreadCount((mentionsData.unreadCount || 0) + (contactsData.unreadCount || 0) + (parsingData.unreadCount || 0) + (researchData.unreadCount || 0));
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

    // Don't fetch on auth pages (prevents redirect loops)
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/auth")) {
      return;
    }

    const fetchUserId = async () => {
      try {
        const response = await fetch("/api/v1/users/me");
        if (response.status === 401) {
          // Session expired - only redirect if not already on auth page
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
            window.location.href = "/auth/login";
          }
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

  // Fetch single mention notification by ID (for optimistic updates)
  const fetchNotificationByMentionId = useCallback(async (mentionId: string) => {
    try {
      const response = await fetch("/api/v1/notifications/mentions?limit=20&includeRead=false");
      if (!response.ok) return null;

      const data = await response.json();
      const newNotification = data.notifications.find((n: LegacyNotification) => n.id === mentionId);
      return newNotification ? { ...newNotification, type: "mention" as const } : null;
    } catch (err) {
      logError("fetch-single-notification", err);
      return null;
    }
  }, []);

  // Fetch single parsing complete notification by ID (includes full insights from API)
  const fetchNotificationByParsingId = useCallback(async (notificationId: string): Promise<ParsingCompleteNotification | null> => {
    try {
      const response = await fetch("/api/v1/notifications/parsing-complete?limit=20&includeRead=true");
      if (!response.ok) return null;

      const data = await response.json();
      const notification = data.notifications.find((n: ParsingCompleteNotification) => n.id === notificationId);
      return notification || null;
    } catch (err) {
      logError("fetch-parsing-notification", err);
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

  // Handle real-time contacts ready event
  const handleContactsReady = useCallback(
    async (data: {
      notificationId: string;
      gongCallId?: string;
      granolaNoteId?: string;
      contactCount: number;
      opportunityId: string;
      opportunityName: string;
      callTitle: string;
    }) => {
      // Optimistically increment unread count
      setUnreadCount((prev) => prev + 1);

      // Create notification object from event data
      const newNotification: ContactsReadyNotification = {
        id: data.notificationId,
        type: "contacts_ready",
        contactCount: data.contactCount,
        opportunityId: data.opportunityId,
        opportunityName: data.opportunityName,
        callTitle: data.callTitle,
        gongCallId: data.gongCallId || null,
        granolaNoteId: data.granolaNoteId || null,
        parsedPeople: null, // Will be fetched when clicked
        meetingDate: null,
        isRead: false,
        createdAt: new Date().toISOString(),
        readAt: null,
      };

      // Add to notification list
      setNotifications((prev) => [newNotification, ...prev]);

      // Show toast notification
      toast.info(`${data.contactCount} contact${data.contactCount !== 1 ? "s" : ""} ready to import`, {
        description: `From "${data.callTitle}" on ${data.opportunityName}`,
        action: {
          label: "Import",
          onClick: () => {
            handleNotificationClick(newNotification);
          },
        },
        duration: 8000,
      });
    },
    []
  );

  // Handle real-time parsing complete event
  const handleParsingComplete = useCallback(
    async (data: {
      notificationId: string;
      gongCallId?: string;
      granolaNoteId?: string;
      opportunityId: string;
      opportunityName: string;
      callTitle: string;
    }) => {
      // Optimistically increment unread count
      setUnreadCount((prev) => prev + 1);

      // Create placeholder notification object from event data (for immediate UI update)
      const placeholderNotification: ParsingCompleteNotification = {
        id: data.notificationId,
        type: "parsing_complete",
        opportunityId: data.opportunityId,
        opportunityName: data.opportunityName,
        callTitle: data.callTitle,
        gongCallId: data.gongCallId || null,
        granolaNoteId: data.granolaNoteId || null,
        meetingDate: null,
        insights: null, // Will be fetched when clicked
        isRead: false,
        createdAt: new Date().toISOString(),
        readAt: null,
      };

      // Add placeholder to notification list immediately
      setNotifications((prev) => [placeholderNotification, ...prev]);

      // Show toast notification - fetch full data when View is clicked
      toast.info("Transcript parsed successfully", {
        description: `"${data.callTitle}" insights are ready`,
        action: {
          label: "View",
          onClick: async () => {
            // Fetch full notification with insights from API before opening dialog
            const fullNotification = await fetchNotificationByParsingId(data.notificationId);
            if (fullNotification) {
              // Update the notification in state with full data
              setNotifications((prev) =>
                prev.map((n) => (n.id === data.notificationId ? fullNotification : n))
              );
              // Call the handler if provided, otherwise navigate to opportunity
              if (onParsingCompleteClick) {
                onParsingCompleteClick(fullNotification);
              } else {
                router.push(`/opportunities/${fullNotification.opportunityId}`);
              }
            } else {
              // Fallback: navigate to opportunity if fetch fails
              router.push(`/opportunities/${data.opportunityId}`);
            }
          },
        },
        duration: 6000,
      });
    },
    [fetchNotificationByParsingId, onParsingCompleteClick, router]
  );

  // Handle real-time account research complete event
  const handleResearchComplete = useCallback(
    async (data: {
      notificationId: string;
      opportunityId: string;
      opportunityName: string;
      accountName: string;
    }) => {
      // Optimistically increment unread count
      setUnreadCount((prev) => prev + 1);

      // Create notification object from event data
      const newNotification: AccountResearchNotification = {
        id: data.notificationId,
        type: "account_research",
        opportunityId: data.opportunityId,
        opportunityName: data.opportunityName,
        accountName: data.accountName,
        researchStatus: "completed",
        researchGeneratedAt: new Date().toISOString(),
        isRead: false,
        createdAt: new Date().toISOString(),
        readAt: null,
      };

      // Add to notification list
      setNotifications((prev) => [newNotification, ...prev]);

      // Show toast notification
      toast.info(`Account research ready for ${data.accountName}`, {
        description: `Research for "${data.opportunityName}" is complete`,
        action: {
          label: "View",
          onClick: () => {
            handleNotificationClick(newNotification);
          },
        },
        duration: 6000,
      });
    },
    []
  );

  // Mark mention notifications as read
  const markMentionsAsRead = useCallback(
    async (mentionIds: string[]) => {
      if (mentionIds.length === 0) return true;
      try {
        const response = await fetch("/api/v1/notifications/mentions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mentionIds }),
        });
        return response.ok;
      } catch (err) {
        logError("mark-mentions-read", err);
        return false;
      }
    },
    []
  );

  // Mark contact notifications as read
  const markContactsAsRead = useCallback(
    async (notificationIds: string[]) => {
      if (notificationIds.length === 0) return true;
      try {
        const response = await fetch("/api/v1/notifications/contacts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds }),
        });
        return response.ok;
      } catch (err) {
        logError("mark-contacts-read", err);
        return false;
      }
    },
    []
  );

  // Mark parsing complete notifications as read
  const markParsingCompleteAsRead = useCallback(
    async (notificationIds: string[]) => {
      if (notificationIds.length === 0) return true;
      try {
        const response = await fetch("/api/v1/notifications/parsing-complete", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds }),
        });
        return response.ok;
      } catch (err) {
        logError("mark-parsing-complete-read", err);
        return false;
      }
    },
    []
  );

  // Mark account research notifications as read
  const markAccountResearchAsRead = useCallback(
    async (notificationIds: string[]) => {
      if (notificationIds.length === 0) return true;
      try {
        const response = await fetch("/api/v1/notifications/account-research", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationIds }),
        });
        return response.ok;
      } catch (err) {
        logError("mark-account-research-read", err);
        return false;
      }
    },
    []
  );

  // Mark specific notifications as read (handles all types)
  const markAsRead = useCallback(
    async (ids: string[]) => {
      // Separate IDs by notification type
      const mentionIds = notifications
        .filter((n) => n.type === "mention" && ids.includes(n.id))
        .map((n) => n.id);
      const contactIds = notifications
        .filter((n) => n.type === "contacts_ready" && ids.includes(n.id))
        .map((n) => n.id);
      const parsingIds = notifications
        .filter((n) => n.type === "parsing_complete" && ids.includes(n.id))
        .map((n) => n.id);
      const researchIds = notifications
        .filter((n) => n.type === "account_research" && ids.includes(n.id))
        .map((n) => n.id);

      const [mentionsResult, contactsResult, parsingResult, researchResult] = await Promise.all([
        markMentionsAsRead(mentionIds),
        markContactsAsRead(contactIds),
        markParsingCompleteAsRead(parsingIds),
        markAccountResearchAsRead(researchIds),
      ]);

      if (mentionsResult && contactsResult && parsingResult && researchResult) {
        // Update local state
        setNotifications((prev) =>
          prev.filter((notification) => !ids.includes(notification.id))
        );
        setUnreadCount((prev) => Math.max(0, prev - ids.length));
        return true;
      }

      return false;
    },
    [notifications, markMentionsAsRead, markContactsAsRead, markParsingCompleteAsRead, markAccountResearchAsRead]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    const allIds = notifications.map((n) => n.id);
    if (allIds.length === 0) return true;
    return markAsRead(allIds);
  }, [notifications, markAsRead]);

  // Handle notification click - different behavior based on type
  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      // Mark as read
      await markAsRead([notification.id]);

      if (notification.type === "contacts_ready") {
        // For contact notifications, call the custom handler if provided
        if (onContactsReadyClick) {
          onContactsReadyClick(notification);
        } else {
          // Fallback: navigate to opportunity
          router.push(`/opportunities/${notification.opportunityId}`);
        }
      } else if (notification.type === "parsing_complete") {
        // For parsing complete notifications, call the custom handler if provided
        if (onParsingCompleteClick) {
          onParsingCompleteClick(notification);
        } else {
          // Fallback: navigate to opportunity
          router.push(`/opportunities/${notification.opportunityId}`);
        }
      } else if (notification.type === "account_research") {
        // For account research notifications, call the custom handler if provided
        if (onAccountResearchClick) {
          onAccountResearchClick(notification);
        } else {
          // Fallback: navigate to opportunity
          router.push(`/opportunities/${notification.opportunityId}`);
        }
      } else {
        // For mention notifications, navigate to the comment
        const { entityType, entityId, pageContext } = notification.comment;
        let url = pageContext || `/${entityType}s/${entityId}`;
        url += `#comment-${notification.commentId}`;
        router.push(url);
      }
    },
    [markAsRead, router, onContactsReadyClick, onParsingCompleteClick, onAccountResearchClick]
  );

  // Set up real-time subscription
  useEffect(() => {
    if (!enabled || !enableRealtime || !userId) {
      return;
    }

    // Subscribe to notification events
    const { channel, unsubscribe } = subscribeToNotifications(userId, {
      onMentionCreated: handleMentionCreated,
      onContactsReady: handleContactsReady,
      onParsingComplete: handleParsingComplete,
      onResearchComplete: handleResearchComplete,
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
  }, [enabled, enableRealtime, userId, handleMentionCreated, handleContactsReady, handleParsingComplete, handleResearchComplete]);

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
