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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Plus, Trash2, FileText, Eye, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { GongCall, NoteType } from "@/types/gong-call";
import { createGongCall, deleteGongCall } from "@/lib/api/gong-calls";
import { useRouter } from "next/navigation";
import { formatDateShort } from "@/lib/format";
import { ParseGongTranscriptDialog } from "./parse-gong-transcript-dialog";
import { GongCallInsightsDialog } from "./gong-call-insights-dialog";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";

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
  const [noteType, setNoteType] = useState<NoteType>("customer");
  const [selectedCallForParsing, setSelectedCallForParsing] = useState<GongCall | null>(null);
  const [selectedCallForViewing, setSelectedCallForViewing] = useState<GongCall | null>(null);
  const router = useRouter();

  // Auto-refresh when any call is in "parsing" state
  useEffect(() => {
    const parsingCalls = calls.filter((call) => call.parsingStatus === "parsing");

    if (parsingCalls.length === 0) return;

    // Poll every 3 seconds
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => clearInterval(interval);
  }, [calls, router]);

  // Show completion toast when a call finishes parsing
  useEffect(() => {
    const completedCalls = calls.filter(
      (call) => call.parsingStatus === "completed" && call.parsedAt
    );

    // Check localStorage to avoid showing toast on initial page load
    completedCalls.forEach((call) => {
      const toastKey = `gong-parsed-${call.id}`;
      const hasShownToast = sessionStorage.getItem(toastKey);

      if (!hasShownToast) {
        toast.success(`"${call.title}" parsed successfully! Click to view insights.`, {
          duration: 5000,
          action: {
            label: "View",
            onClick: () => setSelectedCallForViewing(call),
          },
        });
        sessionStorage.setItem(toastKey, "true");
      }
    });
  }, [calls]);

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
        meetingDate: new Date(meetingDate).toISOString(),
        noteType,
      });
      toast.success("Gong call added successfully!");
      setIsAddDialogOpen(false);
      setTitle("");
      setUrl("");
      setMeetingDate("");
      setNoteType("customer");
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
          {calls.map((call) => {
            const isParsing = call.parsingStatus === "parsing";
            const hasFailed = call.parsingStatus === "failed";
            const hasCompleted = call.parsingStatus === "completed" && !!call.parsedAt;

            return (
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

                  {/* Status Badges */}
                  {isParsing && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Parsing...
                    </Badge>
                  )}
                  {hasCompleted && (
                    <Badge variant="secondary" className="text-xs">
                      Parsed
                    </Badge>
                  )}
                  {hasFailed && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="destructive" className="text-xs flex items-center gap-1 cursor-help">
                            <AlertCircle className="h-3 w-3" />
                            Failed
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">{call.parsingError || "Unknown error"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                  {/* Action Buttons */}
                  {hasCompleted ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCallForViewing(call)}
                      title="View Insights"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) : hasFailed ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCallForParsing(call)}
                      title="Retry Parsing"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  ) : !isParsing ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCallForParsing(call)}
                      title="Parse Transcript"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCall(call.id, call.title)}
                    title="Delete"
                    disabled={isParsing}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
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
                Is this a customer-facing call or internal discussion?
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

      {/* Parse Transcript Dialog */}
      {selectedCallForParsing && (
        <ParseGongTranscriptDialog
          open={!!selectedCallForParsing}
          onOpenChange={(open) => {
            if (!open) setSelectedCallForParsing(null);
          }}
          opportunityId={opportunityId}
          gongCallId={selectedCallForParsing.id}
          onContactsImported={() => {
            router.refresh();
          }}
          onParsingStarted={() => {
            router.refresh();
          }}
        />
      )}

      {/* View Insights Dialog */}
      {selectedCallForViewing && selectedCallForViewing.parsedAt && (
        <GongCallInsightsDialog
          open={!!selectedCallForViewing}
          onOpenChange={(open) => {
            if (!open) setSelectedCallForViewing(null);
          }}
          gongCallTitle={selectedCallForViewing.title}
          opportunityId={opportunityId}
          insights={{
            painPoints: (selectedCallForViewing.painPoints as string[]) || [],
            goals: (selectedCallForViewing.goals as string[]) || [],
            people: (selectedCallForViewing.parsedPeople as PersonExtracted[]) || [],
            nextSteps: (selectedCallForViewing.nextSteps as string[]) || [],
          }}
          onContactsImported={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
