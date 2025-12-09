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
import { Sparkles, Copy, ChevronDown, Info } from "lucide-react";
import { InlineMarkdownWithAI } from "@/components/ui/inline-markdown";
import { formatDateShort } from "@/lib/format";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";

interface BusinessProposalTabProps {
  opportunityId: string;
  businessProposalContent: string | null | undefined;
  businessProposalGeneratedAt: string | null | undefined;
  businessProposalGenerationStatus: string | null | undefined;
  hasConsolidatedData: boolean;
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
  hasConsolidatedData,
  onFieldUpdate,
}: BusinessProposalTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState(
    businessProposalGenerationStatus
  );
  const router = useRouter();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationStatus("generating");
    try {
      const response = await fetch("/api/v1/ai/business-impact-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate proposal");
      }

      setGenerationStatus("completed");
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

  const handleCopy = () => {
    if (businessProposalContent) {
      navigator.clipboard.writeText(businessProposalContent);
      toast.success("Proposal copied to clipboard!");
    }
  };

  const isLoading = isGenerating || generationStatus === "generating";

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">About Business Impact Proposals</p>
              <p>
                This AI-generated document follows an 8-section executive template designed
                for quick decision-making. It uses data from your call insights (pain points,
                goals, metrics) to populate the proposal. Missing data will be marked with
                <code className="mx-1 px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-xs">
                  [DATA NEEDED]
                </code>
                placeholders for you to fill in.
              </p>
              {!hasConsolidatedData && (
                <p className="mt-2 text-amber-700 dark:text-amber-300">
                  <strong>Tip:</strong> Parse some Gong call transcripts first to get better
                  results. The AI uses consolidated pain points, goals, and metrics from your calls.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Proposal Card */}
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
                {businessProposalContent && (
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                )}
              </div>

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
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
