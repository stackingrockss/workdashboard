"use client";

// Dialog for adding a Gong call recording linked to a calendar event
// Pre-fills title and date from the calendar event

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createGongCall } from "@/lib/api/gong-calls";
import { formatDateShort } from "@/lib/format";
import type { NoteType } from "@/types/gong-call";
import type { PreselectedCalendarEvent } from "@/types/timeline";

interface AddGongFromCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  calendarEvent: PreselectedCalendarEvent;
  onSuccess: () => void;
}

export function AddGongFromCalendarDialog({
  open,
  onOpenChange,
  opportunityId,
  calendarEvent,
  onSuccess,
}: AddGongFromCalendarDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [url, setUrl] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("customer");
  const [transcriptText, setTranscriptText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      toast.error("Please enter the Gong recording URL");
      return;
    }

    setIsSubmitting(true);
    try {
      const meetingDate = new Date(calendarEvent.startTime).toISOString();

      await createGongCall(opportunityId, {
        title: calendarEvent.title,
        url,
        meetingDate,
        noteType,
        transcriptText: transcriptText.trim() || undefined,
        calendarEventId: calendarEvent.id,
      });

      const successMessage = transcriptText.trim()
        ? "Gong call added. Parsing transcript in background..."
        : "Gong call added successfully!";
      toast.success(successMessage);

      // Reset form
      setUrl("");
      setNoteType("customer");
      setTranscriptText("");

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add Gong call"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Gong Recording</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Meeting info banner */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">Linking to meeting:</p>
            <p className="font-medium">{calendarEvent.title}</p>
            <p className="text-sm text-muted-foreground">
              {formatDateShort(
                typeof calendarEvent.startTime === "string"
                  ? calendarEvent.startTime
                  : calendarEvent.startTime.toISOString()
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gong-url">Gong Recording URL *</Label>
            <Input
              id="gong-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://app.gong.io/call?id=..."
              required
            />
            <p className="text-xs text-muted-foreground">
              Copy the URL from your Gong recording and paste it here
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note-type">Note Type *</Label>
            <Select
              value={noteType}
              onValueChange={(value) => setNoteType(value as NoteType)}
            >
              <SelectTrigger id="note-type">
                <SelectValue placeholder="Select note type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Is this a customer-facing call or internal discussion?
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transcript-text">Transcript (Optional)</Label>
            <Textarea
              id="transcript-text"
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Paste Gong transcript here (optional)..."
              rows={6}
              className="resize-y"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {transcriptText.trim()
                  ? transcriptText.length >= 100
                    ? "✓ Transcript will be parsed automatically"
                    : `Need ${100 - transcriptText.length} more characters (min 100)`
                  : "You can paste the transcript now or add it later"}
              </span>
              <span
                className={
                  transcriptText.length > 100000 ? "text-destructive" : ""
                }
              >
                {transcriptText.length.toLocaleString()} / 100,000
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Gong Call"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
