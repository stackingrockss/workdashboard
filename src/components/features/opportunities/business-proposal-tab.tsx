"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Copy, ChevronDown, FileText, X, Plus, HelpCircle } from "lucide-react";
import { InlineMarkdownWithAI } from "@/components/ui/inline-markdown";
import { formatDateShort } from "@/lib/format";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { markdownToHtml } from "@/lib/utils/markdown-to-html";

interface BusinessProposalTabProps {
  opportunityId: string;
  businessProposalContent: string | null | undefined;
  businessProposalGeneratedAt: string | null | undefined;
  businessProposalGenerationStatus: string | null | undefined;
  businessCaseQuestions?: string | null;
  onFieldUpdate: (
    field: keyof OpportunityUpdateInput,
    value: string | number | null
  ) => Promise<void>;
}

export function BusinessProposalTab({
  opportunityId,
  businessProposalContent,
  businessProposalGeneratedAt,
  businessProposalGenerationStatus,
  businessCaseQuestions,
  onFieldUpdate,
}: BusinessProposalTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(
    businessProposalGenerationStatus
  );
  const [showContextInput, setShowContextInput] = useState(false);
  const [additionalContext, setAdditionalContext] = useState("");
  const router = useRouter();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationStatus("generating");
    try {
      const response = await fetch("/api/v1/ai/business-impact-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunityId,
          additionalContext: additionalContext.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate proposal");
      }

      setGenerationStatus("completed");
      setShowContextInput(false);
      setAdditionalContext("");
      toast.success("Business Impact Proposal generated!");
      router.refresh();
    } catch (error) {
      setGenerationStatus("failed");
      toast.error(
        error instanceof Error ? error.message : "Generation failed"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPlainText = () => {
    if (businessProposalContent) {
      navigator.clipboard.writeText(businessProposalContent);
      toast.success("Copied as plain text!");
    }
  };

  const handleCopyRichText = async () => {
    if (!businessProposalContent) return;

    try {
      const html = markdownToHtml(businessProposalContent);

      // Use the Clipboard API to copy both HTML and plain text
      const blob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([businessProposalContent], { type: "text/plain" });

      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blob,
          "text/plain": textBlob,
        }),
      ]);

      toast.success("Copied! Paste into Google Docs for formatted text.");
    } catch (error) {
      // Fallback to plain text if rich text copy fails
      console.error("Rich text copy failed:", error);
      navigator.clipboard.writeText(businessProposalContent);
      toast.success("Copied as plain text (rich text not supported in this browser)");
    }
  };

  const isLoading = isGenerating || generationStatus === "generating";

  return (
    <div className="space-y-6">
      <Collapsible defaultOpen={true}>
        <Card className="border-2 shadow-md hover:shadow-lg transition-shadow">
          <CollapsibleTrigger className="w-full group">
            <CardHeader className="cursor-pointer hover:bg-muted/70 transition-all duration-200 py-5">
              <CardTitle className="flex items-center justify-between text-lg">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">Business Impact Proposal</span>
                  {businessProposalGeneratedAt && (
                    <span className="text-xs text-muted-foreground font-normal">
                      Generated {formatDateShort(businessProposalGeneratedAt)}
                    </span>
                  )}
                </div>
                <ChevronDown className="h-6 w-6 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* Action Buttons */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    variant="default"
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isLoading
                      ? "Generating..."
                      : businessProposalContent
                      ? "Regenerate Proposal"
                      : "Generate Proposal"}
                  </Button>
                  {!isLoading && (
                    <Button
                      onClick={() => setShowContextInput(!showContextInput)}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                    >
                      {showContextInput ? (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Hide context
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Add context
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {businessProposalContent && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyRichText}>
                      <FileText className="h-4 w-4 mr-2" />
                      Copy for Google Docs
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCopyPlainText}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Plain
                    </Button>
                  </div>
                )}
              </div>

              {/* Additional Context Input */}
              {showContextInput && (
                <div className="space-y-2 p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
                  <Label htmlFor="additional-context" className="text-sm font-medium">
                    Additional Context
                  </Label>
                  <Textarea
                    id="additional-context"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="Add any additional context for this proposal generation. For example: recent conversations, competitive intel, budget info, specific pain points to emphasize, or timing considerations..."
                    rows={4}
                    maxLength={5000}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {additionalContext.length}/5000 characters
                  </p>
                </div>
              )}

              {/* Proposal Content */}
              <InlineMarkdownWithAI
                label=""
                value={businessProposalContent || ""}
                onSave={async (value) =>
                  onFieldUpdate("businessProposalContent", value || null)
                }
                placeholder={
                  isLoading
                    ? "Generating Business Impact Proposal with AI... This may take 20-60 seconds."
                    : generationStatus === "failed"
                    ? "AI generation failed. Click 'Generate Proposal' to retry."
                    : "Click 'Generate Proposal' to create an AI-powered Business Impact Proposal based on your opportunity data and call insights."
                }
                rows={20}
                className="border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950"
                useRichTextEditor={true}
                enableAI={true}
                opportunityId={opportunityId}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Discovery Questions */}
      {businessCaseQuestions && (
        <Collapsible defaultOpen={false}>
          <Card className="border-l-4 border-l-blue-500">
            <CollapsibleTrigger className="w-full group">
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">Discovery Questions</span>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  Questions to ask the customer to gather ROI data and quantify pain points.
                </p>
                <InlineMarkdownWithAI
                  label=""
                  value={businessCaseQuestions}
                  onSave={async (value) => onFieldUpdate("businessCaseQuestions", value)}
                  placeholder="Questions will appear here after generation..."
                  rows={8}
                  useRichTextEditor={true}
                  enableAI={true}
                  opportunityId={opportunityId}
                />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
