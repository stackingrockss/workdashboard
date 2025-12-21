"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContentFramework,
  ContextSelection,
  GeneratedContent,
} from "@/types/framework";
import { FrameworkCard } from "./FrameworkCard";
import { ContextSelectionPanel } from "./ContextSelectionPanel";
import { CreateFrameworkDialog } from "./CreateFrameworkDialog";
import {
  Search,
  Check,
  ChevronRight,
  Sparkles,
  FileText,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FrameworkSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  opportunityName: string;
  hasAccountResearch?: boolean;
  hasConsolidatedInsights?: boolean;
  onGenerate: (content: GeneratedContent) => void;
}

type Step = "framework" | "context";

export const FrameworkSelectionDialog = ({
  open,
  onOpenChange,
  opportunityId,
  opportunityName,
  hasAccountResearch = false,
  hasConsolidatedInsights = false,
  onGenerate,
}: FrameworkSelectionDialogProps) => {
  const [step, setStep] = useState<Step>("framework");
  const [scope, setScope] = useState<"all" | "company" | "personal">("all");
  const [search, setSearch] = useState("");
  const [frameworks, setFrameworks] = useState<ContentFramework[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch frameworks (auto-seed defaults if none exist)
  useEffect(() => {
    if (!open) return;

    const fetchFrameworks = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (scope !== "all") params.set("scope", scope);
        if (search) params.set("search", search);

        const response = await fetch(`/api/v1/frameworks?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          let fetchedFrameworks = data.frameworks || [];

          // If no frameworks exist and this is the initial load (no search/filter),
          // try to seed default frameworks
          if (fetchedFrameworks.length === 0 && scope === "all" && !search) {
            try {
              const seedResponse = await fetch("/api/v1/frameworks/seed", {
                method: "POST",
              });
              if (seedResponse.ok) {
                // Re-fetch after seeding
                const retryResponse = await fetch(`/api/v1/frameworks?${params.toString()}`);
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  fetchedFrameworks = retryData.frameworks || [];
                }
              }
            } catch (seedError) {
              console.error("Failed to seed default frameworks:", seedError);
            }
          }

          setFrameworks(fetchedFrameworks);
        }
      } catch (error) {
        console.error("Failed to fetch frameworks:", error);
        toast.error("Failed to load frameworks");
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(fetchFrameworks, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, scope, search]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("framework");
      setSelectedFramework(null);
      setSearch("");
      setContextSelection({
        gongCallIds: [],
        granolaNoteIds: [],
        googleNoteIds: [],
        includeAccountResearch: hasAccountResearch,
        includeConsolidatedInsights: hasConsolidatedInsights,
        additionalContext: "",
      });
    }
  }, [open, hasAccountResearch, hasConsolidatedInsights]);

  const handleSelectFramework = (framework: ContentFramework) => {
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
      onGenerate(data.generatedContent);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to generate content:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate content"
      );
    } finally {
      setGenerating(false);
    }
  };

  // Parse sections for selected framework
  const selectedSections = selectedFramework
    ? Array.isArray(selectedFramework.sections)
      ? selectedFramework.sections
      : []
    : [];

  // Handle new framework created
  const handleFrameworkCreated = (framework: ContentFramework) => {
    setFrameworks((prev) => [framework, ...prev]);
    setSelectedFramework(framework);
    setCreateDialogOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "framework" ? "Select Framework" : "Generate"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 px-1 pb-4 border-b">
          <StepIndicator
            number={1}
            label="Deal"
            isComplete={true}
            isActive={false}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            number={2}
            label="Select Framework"
            isComplete={step === "context"}
            isActive={step === "framework"}
          />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator
            number={3}
            label="Generate"
            isComplete={false}
            isActive={step === "context"}
          />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-hidden">
          {step === "framework" ? (
            <div className="h-full flex flex-col">
              {/* Tabs and search */}
              <div className="flex items-center justify-between gap-4 py-3">
                <Tabs
                  value={scope}
                  onValueChange={(v) => setScope(v as typeof scope)}
                >
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="company">Company</TabsTrigger>
                    <TabsTrigger value="personal">Personal</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search frameworks..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create New
                  </Button>
                </div>
              </div>

              {/* Frameworks grid */}
              <ScrollArea className="flex-1">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pb-4 pr-4">
                  {/* Blank document option */}
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors hover:border-primary/50 flex flex-col items-center justify-center text-center min-h-[160px]",
                      !selectedFramework && "border-primary bg-primary/5"
                    )}
                    onClick={() => setSelectedFramework(null)}
                  >
                    <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="font-medium text-sm">
                      Start with a blank document
                    </p>
                  </div>

                  {/* Loading skeletons */}
                  {loading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-[160px] rounded-lg" />
                    ))}

                  {/* Framework cards */}
                  {!loading &&
                    frameworks.map((framework) => (
                      <FrameworkCard
                        key={framework.id}
                        brief={framework}
                        isSelected={selectedFramework?.id === framework.id}
                        onClick={() => handleSelectFramework(framework)}
                      />
                    ))}

                  {/* Empty state */}
                  {!loading && frameworks.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground">
                      <p>No frameworks found</p>
                      {search && (
                        <p className="text-sm mt-1">
                          Try adjusting your search
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Continue button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleContinueToContext}
                  disabled={!selectedFramework}
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full flex gap-6 py-3">
              {/* Left: Selected framework preview */}
              <div className="w-1/3 shrink-0">
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">
                    Selected Framework
                  </p>
                  <h3 className="font-semibold mb-2">
                    {selectedFramework?.name}
                  </h3>
                  {selectedFramework?.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {selectedFramework.description}
                    </p>
                  )}
                  {selectedSections.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Sections:
                      </p>
                      {selectedSections.map((section, i) => (
                        <p key={i} className="text-sm text-muted-foreground">
                          {section.title}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Context selection */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1">
                  <ContextSelectionPanel
                    opportunityId={opportunityId}
                    value={contextSelection}
                    onChange={setContextSelection}
                    hasAccountResearch={hasAccountResearch}
                    hasConsolidatedInsights={hasConsolidatedInsights}
                  />
                </ScrollArea>

                {/* Action buttons */}
                <div className="flex justify-between pt-4 border-t mt-4">
                  <Button variant="outline" onClick={handleBackToFrameworks}>
                    Back
                  </Button>
                  <Button onClick={handleGenerate} disabled={generating}>
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Create Framework Dialog */}
        <CreateFrameworkDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCreated={handleFrameworkCreated}
        />
      </DialogContent>
    </Dialog>
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
