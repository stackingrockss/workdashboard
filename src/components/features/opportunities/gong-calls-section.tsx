"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Plus, Trash2, FileText, Eye, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { GongCall, NoteType } from "@/types/gong-call";
import { createGongCall, deleteGongCall } from "@/lib/api/gong-calls";
import { useRouter } from "next/navigation";
import { formatDateShort } from "@/lib/format";
import { ParseGongTranscriptDialog } from "./parse-gong-transcript-dialog";
import { GongCallInsightsDialog } from "./gong-call-insights-dialog";
import { ConsolidatedInsightsCard } from "./consolidated-insights-card";
import { PersonExtracted } from "@/lib/ai/parse-gong-transcript";
import type { RiskAssessment } from "@/types/gong-call";

interface GongCallsSectionProps {
  opportunityId: string;
  calls: GongCall[];
  // Consolidated insights (optional - shown when 2+ calls parsed)
  consolidatedPainPoints?: string[] | null;
  consolidatedGoals?: string[] | null;
  consolidatedRiskAssessment?: RiskAssessment | null;
  lastConsolidatedAt?: string | null;
  consolidationCallCount?: number | null;
}

export function GongCallsSection({
  opportunityId,
  calls,
  consolidatedPainPoints,
  consolidatedGoals,
  consolidatedRiskAssessment,
  lastConsolidatedAt,
  consolidationCallCount,
}: GongCallsSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("customer");
  const [transcriptText, setTranscriptText] = useState("");
  const [selectedCallForParsing, setSelectedCallForParsing] = useState<GongCall | null>(null);
  const [selectedCallForViewing, setSelectedCallForViewing] = useState<GongCall | null>(null);
  const [autoOpenContactImport, setAutoOpenContactImport] = useState(false);
  const [isConsolidating, setIsConsolidating] = useState(false);
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

    // Check sessionStorage to avoid showing toast on initial page load
    completedCalls.forEach((call) => {
      const toastKey = `gong-parsed-${call.id}`;
      const hasShownToast = sessionStorage.getItem(toastKey);

      if (!hasShownToast) {
        // Count contacts extracted
        const peopleCount = (call.parsedPeople as PersonExtracted[] | null)?.length || 0;

        // Create message with contact count
        let message = `"${call.title}" parsed successfully!`;
        if (peopleCount > 0) {
          message += ` ${peopleCount} contact${peopleCount !== 1 ? 's' : ''} found.`;
        }

        toast.success(message, {
          duration: 6000,
          action: {
            label: "Review & Import",
            onClick: () => {
              setAutoOpenContactImport(true);
              setSelectedCallForViewing(call);
            },
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
        transcriptText: transcriptText.trim() || undefined,
      });
      const successMessage = transcriptText.trim()
        ? "Call added. Parsing transcript in background..."
        : "Gong call added successfully!";
      toast.success(successMessage);
      setIsAddDialogOpen(false);
      setTitle("");
      setUrl("");
      setMeetingDate("");
      setNoteType("customer");
      setTranscriptText("");
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

  const handleTriggerConsolidation = async () => {
    setIsConsolidating(true);
    try {
      const response = await fetch(`/api/v1/opportunities/${opportunityId}/consolidate-insights`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to trigger consolidation");
      }

      toast.success("Consolidation started! Refreshing in a moment...");

      // Wait a few seconds for Inngest job to complete, then refresh
      setTimeout(() => {
        router.refresh();
      }, 5000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to trigger consolidation");
      setIsConsolidating(false);
    }
  };

  // Count parsed calls
  const parsedCallCount = calls.filter(
    (call) => call.parsingStatus === "completed" && call.parsedAt
  ).length;

  // Check if we should show consolidated insights
  const showConsolidated =
    consolidatedPainPoints &&
    consolidatedGoals &&
    consolidatedRiskAssessment &&
    lastConsolidatedAt &&
    consolidationCallCount &&
    consolidationCallCount >= 2;

  // Check if consolidation should be available but hasn't run
  const shouldConsolidate = parsedCallCount >= 2 && !showConsolidated;

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

      {/* Consolidation Trigger Prompt (shown when 2+ calls parsed but not consolidated) */}
      {shouldConsolidate && (
        <div className="mb-6 p-4 border-2 border-blue-500 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Ready to Consolidate Insights
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                You have {parsedCallCount} parsed calls. Generate a consolidated summary of pain points,
                goals, and risk assessment across all calls.
              </p>
            </div>
            <Button
              onClick={handleTriggerConsolidation}
              disabled={isConsolidating}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isConsolidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Consolidating...
                </>
              ) : (
                <>Generate Summary</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Consolidated Insights Card (shown when 2+ calls parsed) */}
      {showConsolidated && (
        <div className="mb-6">
          <ConsolidatedInsightsCard
            opportunityId={opportunityId}
            consolidatedPainPoints={consolidatedPainPoints}
            consolidatedGoals={consolidatedGoals}
            consolidatedRiskAssessment={consolidatedRiskAssessment}
            lastConsolidatedAt={lastConsolidatedAt}
            consolidationCallCount={consolidationCallCount}
            onReconsolidate={() => router.refresh()}
          />
        </div>
      )}

      {/* Individual Calls Section */}
      {showConsolidated && (
        <div className="mb-3">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Individual Calls
          </h4>
        </div>
      )}

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
                      onClick={() => {
                        console.log('View Insights clicked. Call data:', {
                          id: call.id,
                          title: call.title,
                          hasPainPoints: !!call.painPoints,
                          hasGoals: !!call.goals,
                          hasParsedPeople: !!call.parsedPeople,
                          hasNextSteps: !!call.nextSteps,
                          painPointsType: typeof call.painPoints,
                          painPointsValue: call.painPoints,
                        });
                        setSelectedCallForViewing(call);
                      }}
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
                <span className={transcriptText.length > 100000 ? "text-destructive" : ""}>
                  {transcriptText.length.toLocaleString()} / 100,000
                </span>
              </div>
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
            if (!open) {
              setSelectedCallForViewing(null);
              setAutoOpenContactImport(false); // Reset flag when dialog closes
            }
          }}
          gongCallTitle={selectedCallForViewing.title}
          opportunityId={opportunityId}
          insights={{
            painPoints: (selectedCallForViewing.painPoints as string[]) || [],
            goals: (selectedCallForViewing.goals as string[]) || [],
            people: (selectedCallForViewing.parsedPeople as PersonExtracted[]) || [],
            nextSteps: (selectedCallForViewing.nextSteps as string[]) || [],
          }}
          riskAssessment={(selectedCallForViewing.riskAssessment as RiskAssessment) || null}
          onContactsImported={() => {
            router.refresh();
          }}
          autoOpenContactImport={autoOpenContactImport}
        />
      )}
    </div>
  );
}
