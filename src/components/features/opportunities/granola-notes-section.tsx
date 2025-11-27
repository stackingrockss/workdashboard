"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ExternalLink,
  Plus,
  Trash2,
  Eye,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
} from "lucide-react";
import { GranolaNote, NoteType } from "@/types/granola-note";
import { createGranolaNote, deleteGranolaNote } from "@/lib/api/granola-notes";
import { useRouter } from "next/navigation";
import { formatDateShort } from "@/lib/format";
import { ParseGranolaTranscriptDialog } from "./parse-granola-transcript-dialog";
import { GranolaInsightsDialog } from "./granola-insights-dialog";
import { Badge } from "@/components/ui/badge";

interface PreselectedCalendarEvent {
  id: string;
  title: string;
  startTime: string | Date;
}

interface GranolaNoteSectionProps {
  opportunityId: string;
  notes: GranolaNote[];
  // Optional: Preselected calendar event (for linking from calendar)
  preselectedCalendarEvent?: PreselectedCalendarEvent | null;
  onNoteAdded?: () => void;
}

export function GranolaNotesSection({ opportunityId, notes, preselectedCalendarEvent, onNoteAdded }: GranolaNoteSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("customer");
  const [hasAutoOpenedForEvent, setHasAutoOpenedForEvent] = useState(false);
  const [parseDialogNoteId, setParseDialogNoteId] = useState<string | null>(null);
  const [insightsDialogNote, setInsightsDialogNote] = useState<GranolaNote | null>(null);
  const router = useRouter();

  // Auto-open dialog and pre-fill form when preselectedCalendarEvent is provided
  useEffect(() => {
    if (preselectedCalendarEvent && !isAddDialogOpen && !hasAutoOpenedForEvent) {
      // Pre-fill form fields from calendar event
      setTitle(preselectedCalendarEvent.title);
      const eventDate = new Date(preselectedCalendarEvent.startTime);
      setMeetingDate(eventDate.toISOString().split("T")[0]);

      setIsAddDialogOpen(true);
      setHasAutoOpenedForEvent(true);
    }
  }, [preselectedCalendarEvent, isAddDialogOpen, hasAutoOpenedForEvent]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || !meetingDate) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await createGranolaNote(opportunityId, {
        title,
        url,
        meetingDate: new Date(meetingDate).toISOString(),
        noteType,
        calendarEventId: preselectedCalendarEvent?.id || undefined,
      });
      toast.success("Granola note added successfully!");
      setIsAddDialogOpen(false);
      setTitle("");
      setUrl("");
      setMeetingDate("");
      setNoteType("customer");

      // Call the callback if provided
      if (onNoteAdded) {
        onNoteAdded();
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add Granola note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
    if (!confirm(`Delete "${noteTitle}"?`)) return;

    try {
      await deleteGranolaNote(opportunityId, noteId);
      toast.success("Granola note deleted successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete Granola note");
    }
  };

  const handleParsingStarted = () => {
    router.refresh(); // Refresh to show updated parsing status
  };

  const handleContactsImported = () => {
    router.refresh(); // Refresh to show new contacts
  };

  const handleRetryParsing = async (noteId: string) => {
    try {
      const response = await fetch(`/api/v1/granola-notes/${noteId}/retry-parsing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to retry parsing');
      }

      toast.success('Parsing restarted!');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to retry parsing');
    }
  };

  // Helper to get parsing status badge
  const getParsingStatusBadge = (note: GranolaNote) => {
    if (!note.parsingStatus) return null;

    const statusConfig = {
      pending: { icon: Clock, label: 'Pending', variant: 'secondary' as const },
      parsing: { icon: Clock, label: 'Parsing...', variant: 'secondary' as const },
      completed: { icon: CheckCircle2, label: 'Parsed', variant: 'default' as const },
      failed: { icon: AlertCircle, label: 'Failed', variant: 'destructive' as const },
    };

    const config = statusConfig[note.parsingStatus];
    if (!config) return null;

    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="rounded-lg border p-4 md:col-span-2 lg:col-span-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">Granola Meeting Notes</div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Granola notes yet. Add meeting notes to track call history.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <a
                  href={note.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary flex-shrink-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <span className="truncate text-sm font-medium">{note.title}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateShort(note.meetingDate)}
                </span>
                {getParsingStatusBadge(note)}
              </div>
              <div className="flex items-center gap-1 ml-2">
                {/* View Insights button (if parsed) */}
                {note.parsingStatus === 'completed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setInsightsDialogNote(note)}
                    title="View insights"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}

                {/* Parse/Retry Parse button (if not parsed or failed) */}
                {(!note.parsingStatus || note.parsingStatus === 'failed') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setParseDialogNoteId(note.id)}
                    title={note.parsingStatus === 'failed' ? 'Retry parsing' : 'Parse transcript'}
                  >
                    {note.parsingStatus === 'failed' ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {/* Retry button for failed parsing (visible even when not hovering) */}
                {note.parsingStatus === 'failed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryParsing(note.id)}
                    title="Retry with existing transcript"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}

                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeleteNote(note.id, note.title)}
                  title="Delete note"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Parse Transcript Dialog */}
      {parseDialogNoteId && (
        <ParseGranolaTranscriptDialog
          open={!!parseDialogNoteId}
          onOpenChange={(open) => !open && setParseDialogNoteId(null)}
          granolaId={parseDialogNoteId}
          onParsingStarted={handleParsingStarted}
        />
      )}

      {/* Insights Dialog */}
      {insightsDialogNote && (
        <GranolaInsightsDialog
          open={!!insightsDialogNote}
          onOpenChange={(open) => !open && setInsightsDialogNote(null)}
          note={insightsDialogNote}
          opportunityId={opportunityId}
          onContactsImported={handleContactsImported}
        />
      )}

      {/* Add Note Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Granola Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4">
            {/* Show meeting info banner when linking from calendar event */}
            {preselectedCalendarEvent ? (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">Linking to meeting:</p>
                <p className="font-medium">{preselectedCalendarEvent.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateShort(typeof preselectedCalendarEvent.startTime === "string"
                    ? preselectedCalendarEvent.startTime
                    : preselectedCalendarEvent.startTime.toISOString())}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="note-title">Title *</Label>
                  <Input
                    id="note-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Discovery Call with Sarah"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Give this note a descriptive name so you can identify it later
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meeting-date">Meeting Date *</Label>
                  <Input
                    id="meeting-date"
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    When did this meeting take place?
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="note-url">Granola Note URL *</Label>
              <Input
                id="note-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                required
              />
              <p className="text-xs text-muted-foreground">
                Copy the URL from your Granola note and paste it here
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note-type">Note Type *</Label>
              <Select value={noteType} onValueChange={(value) => setNoteType(value as NoteType)}>
                <SelectTrigger id="note-type">
                  <SelectValue placeholder="Select note type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Is this a customer-facing meeting or internal discussion?
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Note"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
