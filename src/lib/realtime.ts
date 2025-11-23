// src/lib/realtime.ts
// Helper functions for Supabase Realtime broadcast

import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { logError } from "@/lib/errors";

/**
 * Create a channel name for comment broadcasts
 * Format: comments:org-{organizationId}:entity-{entityType}-{entityId}
 */
export function getCommentChannelName(
  organizationId: string,
  entityType: string,
  entityId: string
): string {
  return `comments:org-${organizationId}:entity-${entityType}-${entityId}`;
}

/**
 * Broadcast a comment event to all connected clients
 */
export async function broadcastCommentEvent(
  organizationId: string,
  entityType: string,
  entityId: string,
  event: {
    type: "comment:created" | "comment:updated" | "comment:deleted" | "comment:resolved" | "reaction:toggled" | "mention:created";
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const supabase = createClient();
  const channelName = getCommentChannelName(organizationId, entityType, entityId);

  try {
    const channel = supabase.channel(channelName);

    await channel.send({
      type: "broadcast",
      event: event.type,
      payload: {
        ...event.payload,
        organizationId, // Include for security verification
        timestamp: new Date().toISOString(),
      },
    });

    // Don't need to keep channel open on server side
    await supabase.removeChannel(channel);
  } catch (error) {
    logError("realtime-broadcast", error, { organizationId, entityType, entityId });
    // Don't throw - broadcasting is best-effort
  }
}

/**
 * Create a channel name for user notifications
 * Format: notifications:user-{userId}
 */
export function getNotificationChannelName(userId: string): string {
  return `notifications:user-${userId}`;
}

/**
 * Broadcast a notification event to a specific user
 */
export async function broadcastNotificationEvent(
  userId: string,
  event: {
    type: "mention:created";
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const supabase = createClient();
  const channelName = getNotificationChannelName(userId);

  try {
    const channel = supabase.channel(channelName);

    await channel.send({
      type: "broadcast",
      event: event.type,
      payload: {
        ...event.payload,
        userId, // Include for verification
        timestamp: new Date().toISOString(),
      },
    });

    // Don't need to keep channel open on server side
    await supabase.removeChannel(channel);
  } catch (error) {
    logError("realtime-notification-broadcast", error, { userId });
    // Don't throw - broadcasting is best-effort
  }
}

/**
 * Subscribe to notification events for current user
 */
export function subscribeToNotifications(
  userId: string,
  callbacks: {
    onMentionCreated?: (data: { mentionId: string; commentId: string }) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: Error) => void;
  }
): { channel: RealtimeChannel; unsubscribe: () => void } {
  const supabase = createClient();
  const channelName = getNotificationChannelName(userId);

  const channel = supabase.channel(channelName);

  // Subscribe to mention events
  channel
    .on("broadcast", { event: "mention:created" }, ({ payload }) => {
      // Verify userId matches (defense in depth)
      if (payload.userId === userId && callbacks.onMentionCreated) {
        callbacks.onMentionCreated({
          mentionId: payload.mentionId,
          commentId: payload.commentId,
        });
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && callbacks.onConnected) {
        callbacks.onConnected();
      } else if (status === "CHANNEL_ERROR" && callbacks.onError) {
        callbacks.onError(new Error("Channel subscription failed"));
      } else if (status === "TIMED_OUT" && callbacks.onError) {
        callbacks.onError(new Error("Channel subscription timed out"));
      } else if (status === "CLOSED" && callbacks.onDisconnected) {
        callbacks.onDisconnected();
      }
    });

  return {
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}

/**
 * Subscribe to comment events for a specific entity
 */
export function subscribeToComments<TComment = Record<string, unknown>, TReaction = Record<string, unknown>>(
  organizationId: string,
  entityType: string,
  entityId: string,
  callbacks: {
    onCommentCreated?: (comment: TComment) => void;
    onCommentUpdated?: (comment: TComment) => void;
    onCommentDeleted?: (commentId: string) => void;
    onCommentResolved?: (data: { commentId: string; isResolved: boolean }) => void;
    onReactionToggled?: (data: { commentId: string; reaction: TReaction; action: "added" | "removed" }) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: Error) => void;
  }
): { channel: RealtimeChannel; unsubscribe: () => void } {
  const supabase = createClient();
  const channelName = getCommentChannelName(organizationId, entityType, entityId);

  const channel = supabase.channel(channelName);

  // Subscribe to all comment events
  channel
    .on("broadcast", { event: "comment:created" }, ({ payload }) => {
      // Verify organizationId matches (defense in depth)
      if (payload.organizationId === organizationId && callbacks.onCommentCreated) {
        callbacks.onCommentCreated(payload.comment);
      }
    })
    .on("broadcast", { event: "comment:updated" }, ({ payload }) => {
      if (payload.organizationId === organizationId && callbacks.onCommentUpdated) {
        callbacks.onCommentUpdated(payload.comment);
      }
    })
    .on("broadcast", { event: "comment:deleted" }, ({ payload }) => {
      if (payload.organizationId === organizationId && callbacks.onCommentDeleted) {
        callbacks.onCommentDeleted(payload.commentId);
      }
    })
    .on("broadcast", { event: "comment:resolved" }, ({ payload }) => {
      if (payload.organizationId === organizationId && callbacks.onCommentResolved) {
        callbacks.onCommentResolved({
          commentId: payload.commentId,
          isResolved: payload.isResolved,
        });
      }
    })
    .on("broadcast", { event: "reaction:toggled" }, ({ payload }) => {
      if (payload.organizationId === organizationId && callbacks.onReactionToggled) {
        callbacks.onReactionToggled({
          commentId: payload.commentId,
          reaction: payload.reaction,
          action: payload.action,
        });
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED" && callbacks.onConnected) {
        callbacks.onConnected();
      } else if (status === "CHANNEL_ERROR" && callbacks.onError) {
        callbacks.onError(new Error("Channel subscription failed"));
      } else if (status === "TIMED_OUT" && callbacks.onError) {
        callbacks.onError(new Error("Channel subscription timed out"));
      } else if (status === "CLOSED" && callbacks.onDisconnected) {
        callbacks.onDisconnected();
      }
    });

  return {
    channel,
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
}
