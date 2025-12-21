"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentFramework, ContextSelection } from "@/types/framework";
import { FrameworkSelectionStep } from "./FrameworkSelectionStep";
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

type Step = "framework" | "context";

export const GenerateContentWorkflow = ({
  opportunityId,
  opportunityName,
  accountName,
  hasAccountResearch = false,
  hasConsolidatedInsights = false,
}: GenerateContentWorkflowProps) => {
  const router = useRouter();
  const [step, setStep] = useState<Step>("framework");
  const [selectedFramework, setSelectedFramework] =
    useState<ContentFramework | null>(null);
  const [contextSelection, setContextSelection] = useState<ContextSelection>({
    gongCallIds: [],
    granolaNoteIds: [],
    googleNoteIds: [],
    includeAccountResearch: hasAccountResearch,
    includeConsolidatedInsights: hasConsolidatedInsights,
    additionalContext: "",
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

  const handleSelectFramework = (framework: ContentFramework | null) => {
    setSelectedFramework(framework);
  };

  const handleContinueToContext = () => {
    if (!selectedFramework) return;
    setStep("context");
  };

  const handleBackToFrameworks = () => {
    setStep("framework");
  };

  const handleGenerate = async () => {
    if (!selectedFramework) return;

    setGenerating(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/generate-content`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frameworkId: selectedFramework.id,
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
                <Link href={`/opportunities/${opportunityId}`}>
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
              aria-valuenow={step === "framework" ? 1 : 2}
              aria-valuetext={`Step ${step === "framework" ? 1 : 2} of 2: ${step === "framework" ? "Select Framework" : "Select Context"}`}
            >
              <StepIndicator
                number={1}
                label="Select Framework"
                isComplete={step === "context"}
                isActive={step === "framework"}
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
        {step === "framework" ? (
          <FrameworkSelectionStep
            selectedFramework={selectedFramework}
            onSelectFramework={handleSelectFramework}
            onContinue={handleContinueToContext}
            onCancel={() => router.push(`/opportunities/${opportunityId}`)}
          />
        ) : (
          <ContextSelectionStep
            opportunityId={opportunityId}
            selectedFramework={selectedFramework!}
            contextSelection={contextSelection}
            onContextChange={setContextSelection}
            hasAccountResearch={hasAccountResearch}
            hasConsolidatedInsights={hasConsolidatedInsights}
            onBack={handleBackToFrameworks}
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
