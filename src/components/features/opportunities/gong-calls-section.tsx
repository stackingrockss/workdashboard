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
import { GongCall } from "@/types/gong-call";
import { createGongCall, deleteGongCall } from "@/lib/api/gong-calls";
import { useRouter } from "next/navigation";
import { formatDateShort } from "@/lib/format";

interface GongCallsSectionProps {
  opportunityId: string;
  calls: GongCall[];
}

export function GongCallsSection({ opportunityId, calls }: GongCallsSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const router = useRouter();

  const handleAddCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || !meetingDate) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await createGongCall(opportunityId, {
        title,
        url,
        meetingDate: new Date(meetingDate).toISOString()
      });
      toast.success("Gong call added successfully!");
      setIsAddDialogOpen(false);
      setTitle("");
      setUrl("");
      setMeetingDate("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add Gong call");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCall = async (callId: string, callTitle: string) => {
    if (!confirm(`Delete "${callTitle}"?`)) return;

    try {
      await deleteGongCall(opportunityId, callId);
      toast.success("Gong call deleted successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete Gong call");
    }
  };

  return (
    <div className="rounded-lg border p-4 md:col-span-2 lg:col-span-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">Gong Call Recordings</div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Call
        </Button>
      </div>

      {calls.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Gong calls yet. Add call recordings to track conversation history.
        </p>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <div
              key={call.id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <a
                  href={call.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary flex-1 min-w-0"
                >
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{call.title}</span>
                </a>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateShort(call.meetingDate)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                onClick={() => handleDeleteCall(call.id, call.title)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Call Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Gong Call Recording</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCall} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="call-title">Title *</Label>
              <Input
                id="call-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Q4 Strategy Call with John"
                required
              />
              <p className="text-xs text-muted-foreground">
                Give this call recording a descriptive name
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="call-url">Gong Recording URL *</Label>
              <Input
                id="call-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                required
              />
              <p className="text-xs text-muted-foreground">
                Copy the URL from your Gong recording and paste it here
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
                When did this call take place?
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
                {isSubmitting ? "Adding..." : "Add Call"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
