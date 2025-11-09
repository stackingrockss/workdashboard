"use client";

/**
 * Parse Gong Transcript Dialog
 *
 * Two-step flow:
 * 1. Paste transcript → Parse button → API call
 * 2. Display extracted insights (pain points, goals, people, next steps)
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactImportReview } from "@/components/contacts/ContactImportReview";
import { BulkImportResult } from "@/lib/api/contacts";
import {
  ClipboardCopy,
  Loader2,
  CheckCircle2,
  Users,
  Target,
  AlertTriangle,
  ListChecks,
  UserPlus,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface PersonExtracted {
  name: string;
  organization: string;
  role: string;
}

interface ParsedData {
  painPoints: string[];
  goals: string[];
  people: PersonExtracted[];
  nextSteps: string[];
}

interface ParseGongTranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId?: string; // Optional: If provided, enables contact import and DB saving
  gongCallId?: string; // Optional: If provided, saves parsed data to this GongCall record
  onContactsImported?: () => void; // Callback after contacts are imported
  onParsingStarted?: () => void; // Callback after parsing is triggered
}

// ============================================================================
// Component
// ============================================================================

export function ParseGongTranscriptDialog({
  open,
  onOpenChange,
  opportunityId,
  gongCallId,
  onContactsImported,
  onParsingStarted,
}: ParseGongTranscriptDialogProps) {
  const [step, setStep] = useState<"input" | "results" | "import_contacts">("input");
  const [transcriptText, setTranscriptText] = useState("");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep("input");
      setTranscriptText("");
      setParsedData(null);
    }
    onOpenChange(newOpen);
  };

  // Parse transcript via API (background processing)
  const handleParse = async () => {
    if (!transcriptText || transcriptText.trim().length < 100) {
      toast.error("Please paste a valid Gong transcript (minimum 100 characters)");
      return;
    }

    if (!gongCallId) {
      toast.error("GongCall ID is required for parsing");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/ai/parse-gong-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptText,
          gongCallId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to start parsing");
      }

      // Close dialog immediately
      handleOpenChange(false);

      // Trigger refresh callback
      onParsingStarted?.();

      // Show success toast
      toast.success("Transcript parsing started! You'll be notified when it's complete.", {
        duration: 4000,
      });
    } catch (error) {
      console.error("Parse error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to start parsing"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle contact import completion
  const handleImportComplete = (result: BulkImportResult) => {
    onContactsImported?.();
    setStep("results"); // Go back to results view
  };

  // Copy section to clipboard
  const handleCopySection = (content: string, sectionName: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`${sectionName} copied to clipboard`);
  };

  // Go back to edit transcript
  const handleBack = () => {
    setStep("input");
    setParsedData(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parse Gong Transcript</DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Paste your Gong call transcript to extract key insights"
              : "Review extracted insights from the call"}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Input Transcript */}
        {step === "input" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="transcript" className="text-sm font-medium">
                Gong Transcript
              </label>
              <Textarea
                id="transcript"
                placeholder="Paste your Gong transcript here...

Expected format:
[Title] | [Topic]
Recorded on [Date] via [Platform], [Duration]

Participants
- Your company
- Customer company

Transcript
0:00 | Speaker Name
Dialogue...
"
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Minimum 100 characters required</span>
                <span>{transcriptText.length.toLocaleString()} characters</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={isLoading || transcriptText.length < 100}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Parse Transcript
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Display Results */}
        {step === "results" && parsedData && (
          <div className="space-y-4">
            {/* Pain Points Section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-lg">Pain Points / Challenges</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopySection(
                        parsedData.painPoints.map((p) => `• ${p}`).join("\n"),
                        "Pain Points"
                      )
                    }
                  >
                    <ClipboardCopy className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {parsedData.painPoints.length > 0 ? (
                  <ul className="space-y-2">
                    {parsedData.painPoints.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">•</span>
                        <span className="text-sm">{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No pain points identified
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Goals Section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-lg">Goals / Future State</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopySection(
                        parsedData.goals.map((g) => `• ${g}`).join("\n"),
                        "Goals"
                      )
                    }
                  >
                    <ClipboardCopy className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {parsedData.goals.length > 0 ? (
                  <ul className="space-y-2">
                    {parsedData.goals.map((goal, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <span className="text-sm">{goal}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No goals identified</p>
                )}
              </CardContent>
            </Card>

            {/* People Section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    <CardTitle className="text-lg">People</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleCopySection(
                          parsedData.people
                            .map((p) => `${p.name} - ${p.role} (${p.organization})`)
                            .join("\n"),
                          "People"
                        )
                      }
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                    {opportunityId && parsedData.people.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStep("import_contacts")}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Import as Contacts
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {parsedData.people.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Name</th>
                          <th className="text-left py-2 font-medium">Organization</th>
                          <th className="text-left py-2 font-medium">Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData.people.map((person, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="py-2">{person.name}</td>
                            <td className="py-2 text-muted-foreground">
                              {person.organization}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {person.role}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No people identified</p>
                )}
              </CardContent>
            </Card>

            {/* Next Steps Section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-green-500" />
                    <CardTitle className="text-lg">Next Steps</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopySection(
                        parsedData.nextSteps.map((s) => `• ${s}`).join("\n"),
                        "Next Steps"
                      )
                    }
                  >
                    <ClipboardCopy className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {parsedData.nextSteps.length > 0 ? (
                  <ul className="space-y-2">
                    {parsedData.nextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No next steps identified
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={handleBack}>
                Back to Edit
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}

        {/* STEP 3: Import Contacts */}
        {step === "import_contacts" && parsedData && opportunityId && (
          <div className="py-4">
            <ContactImportReview
              people={parsedData.people}
              opportunityId={opportunityId}
              onImportComplete={handleImportComplete}
              onCancel={() => setStep("results")}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
