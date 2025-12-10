// src/components/notifications/NotificationDropdown.tsx
// Dropdown menu for displaying notifications

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCheck, Inbox, AlertCircle } from "lucide-react";
import { useNotifications, ContactsReadyNotification, MentionNotification, ParsingCompleteNotification, AccountResearchNotification } from "@/hooks/useNotifications";
import { MentionNotificationItem } from "./MentionNotificationItem";
import { ContactNotificationItem } from "./ContactNotificationItem";
import { ParsingCompleteNotificationItem } from "./ParsingCompleteNotificationItem";
import { AccountResearchNotificationItem } from "./AccountResearchNotificationItem";
import { ContactImportDialog } from "@/components/contacts/ContactImportDialog";
import { GongCallInsightsDialog } from "@/components/features/opportunities/gong-call-insights-dialog";
import { Badge } from "@/components/ui/badge";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import type { RiskAssessment } from "@/types/gong-call";

export function NotificationDropdown() {
  const [selectedContactNotification, setSelectedContactNotification] = useState<ContactsReadyNotification | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedParsingNotification, setSelectedParsingNotification] = useState<ParsingCompleteNotification | null>(null);
  const [isInsightsDialogOpen, setIsInsightsDialogOpen] = useState(false);

  // Handler for when a contact notification is clicked
  const handleContactsReadyClick = useCallback((notification: ContactsReadyNotification) => {
    setSelectedContactNotification(notification);
    setIsImportDialogOpen(true);
  }, []);

  // Handler for when a parsing complete notification is clicked
  const handleParsingCompleteClick = useCallback((notification: ParsingCompleteNotification) => {
    setSelectedParsingNotification(notification);
    setIsInsightsDialogOpen(true);
  }, []);

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    isConnected,
    markAllAsRead,
    handleNotificationClick,
    refetch,
  } = useNotifications({
    onContactsReadyClick: handleContactsReadyClick,
    onParsingCompleteClick: handleParsingCompleteClick,
  });

  // Handle import complete - refresh notifications
  const handleImportComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle insights dialog close
  const handleInsightsDialogClose = useCallback(() => {
    setIsInsightsDialogOpen(false);
    setSelectedParsingNotification(null);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          aria-haspopup="menu"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          {/* Connection status indicator */}
          {isConnected && (
            <div
              className="absolute bottom-0 right-0 h-2 w-2 bg-green-500 rounded-full border border-background"
              title="Real-time connected"
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        {/* Header */}
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Notifications
            {isConnected && (
              <span className="text-xs text-muted-foreground font-normal">• Live</span>
            )}
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                markAllAsRead();
              }}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <AlertCircle className="h-12 w-12 text-destructive mb-2" />
            <p className="text-sm font-medium">Failed to load notifications</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading notifications...
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No new notifications</p>
            <p className="text-xs text-muted-foreground mt-1">
              You&apos;re all caught up!
            </p>
          </div>
        )}

        {/* Notification List */}
        {!isLoading && !error && notifications.length > 0 && (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1 p-1">
              {notifications.map((notification) => {
                if (notification.type === "contacts_ready") {
                  return (
                    <ContactNotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  );
                } else if (notification.type === "parsing_complete") {
                  return (
                    <ParsingCompleteNotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  );
                } else if (notification.type === "account_research") {
                  return (
                    <AccountResearchNotificationItem
                      key={notification.id}
                      notification={notification as AccountResearchNotification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  );
                } else {
                  return (
                    <MentionNotificationItem
                      key={notification.id}
                      notification={notification as MentionNotification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  );
                }
              })}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {!isLoading && !error && notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-sm text-muted-foreground cursor-pointer">
              View all notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>

      {/* Contact Import Dialog */}
      <ContactImportDialog
        notification={selectedContactNotification}
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportComplete={handleImportComplete}
      />

      {/* Insights Dialog - Use GongCallInsightsDialog for both types */}
      {selectedParsingNotification && (
        <GongCallInsightsDialog
          open={isInsightsDialogOpen}
          onOpenChange={(open) => {
            if (!open) handleInsightsDialogClose();
          }}
          gongCallTitle={selectedParsingNotification.callTitle}
          opportunityId={selectedParsingNotification.opportunityId}
          gongCallId={selectedParsingNotification.gongCallId || selectedParsingNotification.granolaNoteId || ""}
          insights={{
            painPoints: selectedParsingNotification.insights?.painPoints || [],
            goals: selectedParsingNotification.insights?.goals || [],
            people: (selectedParsingNotification.insights?.people as PersonExtracted[]) || [],
            nextSteps: selectedParsingNotification.insights?.nextSteps || [],
          }}
          riskAssessment={(selectedParsingNotification.insights?.riskAssessment as RiskAssessment) || null}
          onContactsImported={refetch}
          onRiskAnalysisComplete={refetch}
        />
      )}
    </DropdownMenu>
  );
}
