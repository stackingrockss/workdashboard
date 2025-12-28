"use client";

/**
 * PendingContactsSection Component
 *
 * Displays pending contact import notifications for a specific opportunity.
 * Shows in the Contacts tab as a reminder when users have contacts
 * extracted from parsed Gong/Granola calls that haven't been imported yet.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, X, Download, Calendar } from "lucide-react";
import { ContactImportDialog } from "./ContactImportDialog";
import { ContactsReadyNotification } from "@/hooks/useNotifications";
import { formatDateShort } from "@/lib/format";
import { toast } from "sonner";

interface PendingContactsSectionProps {
  opportunityId: string;
  onImportComplete?: () => void;
}

// Helper to get dismissed IDs from sessionStorage
const getDismissedIds = (opportunityId: string): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = sessionStorage.getItem(`dismissed-contact-imports-${opportunityId}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

// Helper to save dismissed IDs to sessionStorage
const saveDismissedIds = (opportunityId: string, ids: Set<string>) => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`dismissed-contact-imports-${opportunityId}`, JSON.stringify([...ids]));
  } catch {
    // Ignore storage errors
  }
};

export function PendingContactsSection({
  opportunityId,
  onImportComplete,
}: PendingContactsSectionProps) {
  const [notifications, setNotifications] = useState<ContactsReadyNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<ContactsReadyNotification | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  // Track dismissed notification IDs - persisted to sessionStorage to survive tab switches
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getDismissedIds(opportunityId));

  // Fetch pending notifications for this opportunity
  const fetchNotifications = useCallback(async () => {
    console.log("[PendingContactsSection] Fetching notifications for opportunityId:", opportunityId);
    try {
      // Add cache-busting to prevent stale data
      const response = await fetch(
        `/api/v1/notifications/contacts?opportunityId=${opportunityId}&includeRead=false&_t=${Date.now()}`
      );
      if (!response.ok) throw new Error("Failed to fetch notifications");
      const data = await response.json();
      console.log("[PendingContactsSection] Received notifications:", data);
      // Filter out any locally dismissed notifications (handles race conditions)
      const filteredNotifications = (data.notifications || []).filter(
        (n: ContactsReadyNotification) => !dismissedIds.has(n.id)
      );
      setNotifications(filteredNotifications);
    } catch (error) {
      console.error("[PendingContactsSection] Failed to load pending contacts:", error);
    } finally {
      setIsLoading(false);
    }
  }, [opportunityId, dismissedIds]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Dismiss (mark as read) a notification
  const handleDismiss = async (notificationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    // Immediately add to dismissed set and remove from local state
    // This prevents the notification from reappearing on tab switch
    const newDismissedIds = new Set([...dismissedIds, notificationId]);
    setDismissedIds(newDismissedIds);
    saveDismissedIds(opportunityId, newDismissedIds);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    try {
      const response = await fetch("/api/v1/notifications/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [notificationId] }),
      });
      if (!response.ok) throw new Error("Failed to dismiss");
      toast.success("Notification dismissed");
    } catch {
      // Revert on failure - remove from dismissed set and refetch
      const revertedIds = new Set(dismissedIds);
      revertedIds.delete(notificationId);
      setDismissedIds(revertedIds);
      saveDismissedIds(opportunityId, revertedIds);
      toast.error("Failed to dismiss notification");
      fetchNotifications();
    }
  };

  // Handle import click
  const handleImportClick = (notification: ContactsReadyNotification, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedNotification(notification);
    setIsImportDialogOpen(true);
  };

  // Handle import complete
  const handleImportComplete = () => {
    // Mark the notification as read
    if (selectedNotification) {
      // Remove from local state immediately
      setNotifications((prev) => prev.filter((n) => n.id !== selectedNotification.id));
      // Mark as read in the background
      fetch("/api/v1/notifications/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: [selectedNotification.id] }),
      }).catch(console.error);
    }
    setIsImportDialogOpen(false);
    setSelectedNotification(null);
    onImportComplete?.();
  };

  // Don't render if loading or no pending notifications
  if (isLoading || notifications.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Pending Contact Imports
          </CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300">
            {notifications.length} call{notifications.length !== 1 ? "s" : ""} with contacts ready to import
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-background"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{notification.callTitle}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  {notification.meetingDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateShort(new Date(notification.meetingDate))}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {notification.contactCount} contact{notification.contactCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => handleDismiss(notification.id, e)}
                  className="h-8 w-8 p-0"
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Dismiss</span>
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => handleImportClick(notification, e)}
                  className="h-8"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Import
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <ContactImportDialog
        notification={selectedNotification}
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportComplete={handleImportComplete}
        onDismiss={() => {
          if (selectedNotification) {
            handleDismiss(selectedNotification.id);
          }
        }}
      />
    </>
  );
}
