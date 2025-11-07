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
import {
  ClipboardCopy,
  Loader2,
  CheckCircle2,
  Users,
  Target,
  AlertTriangle,
  ListChecks
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
}

// ============================================================================
// Component
// ============================================================================

export function ParseGongTranscriptDialog({
  open,
  onOpenChange,
}: ParseGongTranscriptDialogProps) {
  const [step, setStep] = useState<"input" | "results">("input");
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

  // Parse transcript via API
  const handleParse = async () => {
    if (!transcriptText || transcriptText.trim().length < 100) {
      toast.error("Please paste a valid Gong transcript (minimum 100 characters)");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/ai/parse-gong-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptText }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to parse transcript");
      }

      setParsedData(result.data);
      setStep("results");
      toast.success("Transcript parsed successfully!");
    } catch (error) {
      console.error("Parse error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to parse transcript"
      );
    } finally {
      setIsLoading(false);
    }
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
      </DialogContent>
    </Dialog>
  );
}
