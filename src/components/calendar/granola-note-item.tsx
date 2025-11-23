"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Trash2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GranolaNote } from "@/types/granola-note";
import { toast } from "sonner";

interface GranolaNoteItemProps {
  note: GranolaNote;
  opportunityId: string;
  onDelete?: () => void;
  onUnlink?: () => void;
}

/**
 * GranolaNoteItem - Display a single Granola note within a calendar event card
 *
 * Features:
 * - Link to Granola URL (opens in new tab)
 * - "Unlink from Meeting" button (removes calendarEventId)
 * - Delete button
 */
export function GranolaNoteItem({
  note,
  opportunityId,
  onDelete,
  onUnlink
}: GranolaNoteItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this Granola note?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/granola-notes/${note.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Granola note deleted");
      onDelete?.();
    } catch (error) {
      console.error("Failed to delete Granola note:", error);
      toast.error("Failed to delete Granola note");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/granola-notes/${note.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: null }),
        }
      );

      if (!response.ok) throw new Error("Failed to unlink");

      toast.success("Granola note unlinked from meeting");
      onUnlink?.();
    } catch (error) {
      console.error("Failed to unlink Granola note:", error);
      toast.error("Failed to unlink Granola note");
    } finally {
      setIsUnlinking(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Granola link */}
        <a
          href={note.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:underline truncate text-primary flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{note.title || "Granola Note"}</span>
        </a>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Unlink */}
        {onUnlink && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="h-8 px-2"
          >
            {isUnlinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Unlink className="h-4 w-4" />
            )}
            <span className="sr-only">Unlink from Meeting</span>
          </Button>
        )}

        {/* Delete */}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="sr-only">Delete</span>
          </Button>
        )}
      </div>
    </div>
  );
}
