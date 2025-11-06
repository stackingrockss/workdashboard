"use client";

import { useState } from "react";
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
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { GranolaNote, NoteType } from "@/types/granola-note";
import { createGranolaNote, deleteGranolaNote } from "@/lib/api/granola-notes";
import { useRouter } from "next/navigation";
import { formatDateShort } from "@/lib/format";

interface GranolaNoteSectionProps {
  opportunityId: string;
  notes: GranolaNote[];
}

export function GranolaNotesSection({ opportunityId, notes }: GranolaNoteSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("customer");
  const router = useRouter();

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
      });
      toast.success("Granola note added successfully!");
      setIsAddDialogOpen(false);
      setTitle("");
      setUrl("");
      setMeetingDate("");
      setNoteType("customer");
      router.refresh();
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
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary flex-1 min-w-0"
                >
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{note.title}</span>
                </a>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateShort(note.meetingDate)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                onClick={() => handleDeleteNote(note.id, note.title)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Note Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Granola Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="note-type">Note Type *</Label>
              <Select value={noteType} onValueChange={(value) => setNoteType(value as NoteType)}>
                <SelectTrigger id="note-type">
                  <SelectValue placeholder="Select note type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
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
