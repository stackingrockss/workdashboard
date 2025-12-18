"use client";

import { useState } from "react";
import { ExternalLink, Eye, FileText, Loader2, Trash2, Unlink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GongCall } from "@/types/gong-call";
import { toast } from "sonner";

interface GongCallItemProps {
  call: GongCall;
  opportunityId: string;
  onDelete?: () => void;
  onUnlink?: () => void;
  onViewInsights?: (call: GongCall) => void;
  onParse?: (call: GongCall) => void;
}

/**
 * GongCallItem - Display a single Gong call within a calendar event card
 *
 * Features:
 * - Link to Gong URL (opens in new tab)
 * - Parsing status badge (Parsing, Parsed, Failed)
 * - "View Insights" button (if parsed)
 * - "Parse Transcript" button (if transcript exists but unparsed)
 * - "Unlink from Meeting" button (removes calendarEventId)
 * - Delete button
 */
export function GongCallItem({
  call,
  opportunityId,
  onDelete,
  onUnlink,
  onViewInsights,
  onParse
}: GongCallItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this Gong call?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/gong-calls/${call.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Gong call deleted");
      onDelete?.();
    } catch (error) {
      console.error("Failed to delete Gong call:", error);
      toast.error("Failed to delete Gong call");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/gong-calls/${call.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: null }),
        }
      );

      if (!response.ok) throw new Error("Failed to unlink");

      toast.success("Gong call unlinked from meeting");
      onUnlink?.();
    } catch (error) {
      console.error("Failed to unlink Gong call:", error);
      toast.error("Failed to unlink Gong call");
    } finally {
      setIsUnlinking(false);
    }
  };

  const getStatusBadge = () => {
    if (!call.parsingStatus) return null;

    switch (call.parsingStatus) {
      case "parsing":
      case "pending":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Parsing...
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            Parsed ✓
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const hasTranscript = !!call.transcriptText;
  const isParsed = call.parsingStatus === "completed";
  const isParsing = call.parsingStatus === "parsing" || call.parsingStatus === "pending";
  const canParse = hasTranscript && !isParsed && !isParsing;

  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Gong link */}
        <a
          href={call.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:underline truncate text-primary flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{call.title || "Gong Recording"}</span>
        </a>

        {/* Status badge */}
        {getStatusBadge()}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* View Insights */}
        {isParsed && onViewInsights && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewInsights(call)}
            className="h-8 px-2"
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">View Insights</span>
          </Button>
        )}

        {/* Parse Transcript */}
        {canParse && onParse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onParse(call)}
            className="h-8 px-2"
          >
            <FileText className="h-4 w-4" />
            <span className="sr-only">Parse Transcript</span>
          </Button>
        )}

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
