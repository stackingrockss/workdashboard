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
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { GoogleNote } from "@/types/google-note";
import { createGoogleNote, deleteGoogleNote } from "@/lib/api/google-notes";
import { useRouter } from "next/navigation";

interface GoogleNotesSectionProps {
  opportunityId: string;
  notes: GoogleNote[];
}

export function GoogleNotesSection({ opportunityId, notes }: GoogleNotesSectionProps) {
  // Defensive check - ensure notes is an array
  const safeNotes = Array.isArray(notes) ? notes : [];
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const router = useRouter();

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await createGoogleNote(opportunityId, { title, url });
      toast.success("Google note added successfully!");
      setIsAddDialogOpen(false);
      setTitle("");
      setUrl("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add Google note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
    if (!confirm(`Delete "${noteTitle}"?`)) return;

    try {
      await deleteGoogleNote(opportunityId, noteId);
      toast.success("Google note deleted successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete Google note");
    }
  };

  return (
    <div className="rounded-lg border p-4 md:col-span-2 lg:col-span-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">Google Notes</div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {safeNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Google notes yet. Link Google Docs or other notes to track important information.
        </p>
      ) : (
        <div className="space-y-2">
          {safeNotes.map((note) => (
            <div
              key={note.id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group"
            >
              <a
                href={note.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-medium hover:text-primary flex-1"
              >
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{note.title}</span>
              </a>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
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
            <DialogTitle>Add Google Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title *</Label>
              <Input
                id="note-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Product Requirements Doc"
                required
              />
              <p className="text-xs text-muted-foreground">
                Give this note a descriptive name so you can identify it later
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note-url">Google Note URL *</Label>
              <Input
                id="note-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
                required
              />
              <p className="text-xs text-muted-foreground">
                Copy the URL from your Google Doc, Sheet, or other note and paste it here
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
