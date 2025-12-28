// src/components/contacts/ContactImportDialog.tsx
// Dialog wrapper for importing contacts from notification

"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactImportReview } from "./ContactImportReview";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import { ContactsReadyNotification } from "@/hooks/useNotifications";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ContactImportDialogProps {
  notification: ContactsReadyNotification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
  onDismiss?: () => void;
}

export function ContactImportDialog({
  notification,
  open,
  onOpenChange,
  onImportComplete,
  onDismiss,
}: ContactImportDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedPeople, setParsedPeople] = useState<PersonExtracted[]>([]);

  // Fetch parsed people data when dialog opens
  useEffect(() => {
    if (!open || !notification) {
      setParsedPeople([]);
      return;
    }

    // If notification already has parsed people data, use it directly
    if (notification.parsedPeople && Array.isArray(notification.parsedPeople)) {
      setParsedPeople(notification.parsedPeople as PersonExtracted[]);
      return;
    }

    // Otherwise fetch from API
    const fetchParsedPeople = async () => {
      setIsLoading(true);
      try {
        let url: string;
        if (notification.gongCallId) {
          url = `/api/v1/opportunities/${notification.opportunityId}/gong-calls/${notification.gongCallId}`;
        } else if (notification.granolaNoteId) {
          url = `/api/v1/opportunities/${notification.opportunityId}/granola-notes/${notification.granolaNoteId}`;
        } else {
          throw new Error("No call or note ID found in notification");
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch call/note data");
        }

        const data = await response.json();
        const people = data.gongCall?.parsedPeople || data.granolaNote?.parsedPeople || data.parsedPeople || [];
        setParsedPeople(people as PersonExtracted[]);
      } catch (error) {
        console.error("Error fetching parsed people:", error);
        toast.error("Failed to load contacts");
        onOpenChange(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchParsedPeople();
  }, [open, notification, onOpenChange]);

  const handleImportComplete = () => {
    onImportComplete?.();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleDontImport = () => {
    onDismiss?.();
    onOpenChange(false);
  };

  if (!notification) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Import Contacts
            <span className="text-sm font-normal text-muted-foreground">
              from &quot;{notification.callTitle}&quot;
            </span>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Loading contacts...</p>
          </div>
        ) : (
          <ContactImportReview
            people={parsedPeople}
            opportunityId={notification.opportunityId}
            onImportComplete={handleImportComplete}
            onCancel={handleCancel}
            onDontImport={handleDontImport}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
