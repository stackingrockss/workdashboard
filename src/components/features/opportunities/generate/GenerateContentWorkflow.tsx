"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentBrief, ContextSelection, BriefCategory } from "@/types/brief";
import { BriefSelectionStep } from "./FrameworkSelectionStep";
import { ContextSelectionStep } from "./ContextSelectionStep";
import { ArrowLeft, Check, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GenerateContentWorkflowProps {
  opportunityId: string;
  opportunityName: string;
  accountName?: string;
  hasAccountResearch?: boolean;
  hasConsolidatedInsights?: boolean;
}

type Step = "brief" | "context";

export const GenerateContentWorkflow = ({
  opportunityId,
  opportunityName,
  accountName,
  hasAccountResearch = false,
  hasConsolidatedInsights = false,
}: GenerateContentWorkflowProps) => {
  const router = useRouter();
  const [step, setStep] = useState<Step>("brief");
  const [selectedBrief, setSelectedBrief] =
    useState<ContentBrief | null>(null);
  const [isBlankDocumentSelected, setIsBlankDocumentSelected] = useState(false);
  const [blankDocCategory, setBlankDocCategory] = useState<BriefCategory>("general");
  const [creatingBlankDoc, setCreatingBlankDoc] = useState(false);
  const [contextSelection, setContextSelection] = useState<ContextSelection>({
    gongCallIds: [],
    granolaNoteIds: [],
    googleNoteIds: [],
    includeAccountResearch: hasAccountResearch,
    includeConsolidatedInsights: hasConsolidatedInsights,
    additionalContext: "",
    referenceDocumentIds: [],
  });
  const [generating, setGenerating] = useState(false);

  // Reset context defaults when insights availability changes
  useEffect(() => {
    setContextSelection((prev) => ({
      ...prev,
      includeAccountResearch: hasAccountResearch,
      includeConsolidatedInsights: hasConsolidatedInsights,
    }));
  }, [hasAccountResearch, hasConsolidatedInsights]);

  const handleSelectBrief = (brief: ContentBrief | null) => {
    setSelectedBrief(brief);
    if (brief) {
      setIsBlankDocumentSelected(false);
    }
  };

  const handleSelectBlankDocument = () => {
    setIsBlankDocumentSelected(true);
    setSelectedBrief(null);
  };

  const handleCreateBlankDocument = async () => {
    setCreatingBlankDoc(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/documents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Untitled Document",
            category: blankDocCategory,
            content: blankDocCategory === "mutual_action_plan" ? undefined : "",
            structuredData: blankDocCategory === "mutual_action_plan" ? { actionItems: [] } : undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create document");
      }

      const data = await response.json();
      toast.success("Document created!");

      router.push(
        `/opportunities/${opportunityId}/documents/${data.document.id}`
      );
    } catch (error) {
      console.error("Failed to create document:", error);
      toast.error("Failed to create document");
    } finally {
      setCreatingBlankDoc(false);
    }
  };

  const handleContinueToContext = () => {
    if (!selectedBrief) return;
    setStep("context");
  };

  const handleBackToBriefs = () => {
    setStep("brief");
  };

  const handleGenerate = async () => {
    if (!selectedBrief) return;

    setGenerating(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/generate-content`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            briefId: selectedBrief.id,
            contextSelection,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start generation");
      }

      const data = await response.json();
      toast.success("Content generation started!");

      // Navigate to the document editor
      router.push(
        `/opportunities/${opportunityId}/documents/${data.generatedContent.id}`
      );
    } catch (error) {
      console.error("Failed to generate content:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate content"
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/opportunities/${opportunityId}?tab=documents`}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">Generate Content</h1>
                  <p className="text-sm text-muted-foreground">
                    {opportunityName}
                    {accountName && ` • ${accountName}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Step indicator */}
            <div
              className="hidden sm:flex items-center gap-2"
              role="progressbar"
              aria-label="Content generation wizard"
              aria-valuemin={1}
              aria-valuemax={2}
              aria-valuenow={step === "brief" ? 1 : 2}
              aria-valuetext={`Step ${step === "brief" ? 1 : 2} of 2: ${step === "brief" ? "Select Brief" : "Select Context"}`}
            >
              <StepIndicator
                number={1}
                label="Select Brief"
                isComplete={step === "context"}
                isActive={step === "brief"}
              />
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <StepIndicator
                number={2}
                label="Select Context & Generate"
                isComplete={false}
                isActive={step === "context"}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {step === "brief" ? (
          <BriefSelectionStep
            selectedBrief={selectedBrief}
            onSelectBrief={handleSelectBrief}
            onContinue={handleContinueToContext}
            onCancel={() => router.push(`/opportunities/${opportunityId}?tab=documents`)}
            isBlankDocumentSelected={isBlankDocumentSelected}
            onSelectBlankDocument={handleSelectBlankDocument}
            onCreateBlankDocument={handleCreateBlankDocument}
            creatingBlankDoc={creatingBlankDoc}
            blankDocCategory={blankDocCategory}
            onBlankDocCategoryChange={setBlankDocCategory}
          />
        ) : (
          <ContextSelectionStep
            opportunityId={opportunityId}
            selectedBrief={selectedBrief!}
            contextSelection={contextSelection}
            onContextChange={setContextSelection}
            hasAccountResearch={hasAccountResearch}
            hasConsolidatedInsights={hasConsolidatedInsights}
            onBack={handleBackToBriefs}
            onGenerate={handleGenerate}
            generating={generating}
          />
        )}
      </div>
    </div>
  );
};

// Step indicator component
interface StepIndicatorProps {
  number: number;
  label: string;
  isComplete: boolean;
  isActive: boolean;
}

const StepIndicator = ({
  number,
  label,
  isComplete,
  isActive,
}: StepIndicatorProps) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
          isComplete
            ? "bg-green-500 text-white"
            : isActive
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
        )}
      >
        {isComplete ? <Check className="h-3.5 w-3.5" /> : number}
      </div>
      <span
        className={cn(
          "text-sm",
          isActive ? "font-medium" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
};
