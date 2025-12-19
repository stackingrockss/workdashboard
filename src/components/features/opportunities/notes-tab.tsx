"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertCircle,
  Target,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { InlineTextarea } from "@/components/ui/inline-editable";
import { ConsolidatedInsightsCard } from "./consolidated-insights-card";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { cn } from "@/lib/utils";
import type { RiskAssessment } from "@/types/gong-call";

interface NotesTabProps {
  opportunity: {
    id: string;
    notes?: string | null;
    painPointsHistory?: string | null;
    goalsHistory?: string | null;
    nextStepsHistory?: string | null;
    // Consolidated insights
    consolidatedPainPoints?: unknown;
    consolidatedGoals?: unknown;
    consolidatedRiskAssessment?: RiskAssessment | null;
    consolidatedWhyAndWhyNow?: unknown;
    consolidatedMetrics?: unknown;
    lastConsolidatedAt?: Date | string | null;
    consolidationCallCount?: number | null;
  };
  onFieldUpdate: (
    field: keyof OpportunityUpdateInput,
    value: string | number | null
  ) => Promise<void>;
  onReconsolidate: () => void;
}

export function NotesTab({
  opportunity,
  onFieldUpdate,
  onReconsolidate,
}: NotesTabProps) {
  const [notesContent, setNotesContent] = useState(opportunity.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isInsightsOpen, setIsInsightsOpen] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle notes change with debounce
  const handleNotesChange = useCallback(
    (content: string) => {
      setNotesContent(content);

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce the save (1.5 seconds)
      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await onFieldUpdate("notes", content || null);
          setLastSaved(new Date());
        } finally {
          setIsSaving(false);
        }
      }, 1500);
    },
    [onFieldUpdate]
  );

  const hasConsolidatedInsights = Boolean(
    opportunity.consolidatedPainPoints &&
    opportunity.consolidatedGoals &&
    opportunity.consolidatedRiskAssessment &&
    opportunity.lastConsolidatedAt &&
    opportunity.consolidationCallCount
  );

  return (
    <div className="space-y-6">
      {/* Main Notes Editor - Hero Section */}
      <Card className="border-2 border-primary/10 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <StickyNote className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Notes</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Your personal notes for this opportunity
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
                  Saving...
                </Badge>
              )}
              {lastSaved && !isSaving && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Saved
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RichTextEditor
            content={notesContent}
            onChange={handleNotesChange}
            placeholder="Start typing your notes... Use formatting, lists, tables, and more."
            className="min-h-[300px]"
            editorClassName="min-h-[250px]"
          />
        </CardContent>
      </Card>

      {/* AI Consolidated Insights */}
      {hasConsolidatedInsights && (
        <div className="mb-4">
          <ConsolidatedInsightsCard
            opportunityId={opportunity.id}
            consolidatedPainPoints={opportunity.consolidatedPainPoints as string[]}
            consolidatedGoals={opportunity.consolidatedGoals as string[]}
            consolidatedRiskAssessment={opportunity.consolidatedRiskAssessment!}
            consolidatedWhyAndWhyNow={(opportunity.consolidatedWhyAndWhyNow as string[] | undefined) ?? undefined}
            consolidatedMetrics={(opportunity.consolidatedMetrics as string[] | undefined) ?? undefined}
            lastConsolidatedAt={
              typeof opportunity.lastConsolidatedAt === "string"
                ? opportunity.lastConsolidatedAt
                : (opportunity.lastConsolidatedAt as Date).toISOString()
            }
            consolidationCallCount={opportunity.consolidationCallCount!}
            onReconsolidate={onReconsolidate}
          />
        </div>
      )}

      {/* Call Insights Section - Collapsible */}
      <Collapsible open={isInsightsOpen} onOpenChange={setIsInsightsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Call Insights</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from Gong call transcripts
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isInsightsOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              {/* Pain Points */}
              <InsightSection
                icon={AlertCircle}
                iconColor="text-orange-500"
                bgColor="bg-orange-500/10"
                borderColor="border-orange-200 dark:border-orange-800"
                bgSurface="bg-orange-50/50 dark:bg-orange-950/30"
                title="Pain Points & Challenges"
                description="Customer problems and friction points"
                value={opportunity.painPointsHistory || ""}
                onSave={(value) => onFieldUpdate("painPointsHistory", value)}
                placeholder="No pain points recorded yet. Parse Gong transcripts to extract insights."
              />

              {/* Goals */}
              <InsightSection
                icon={Target}
                iconColor="text-emerald-500"
                bgColor="bg-emerald-500/10"
                borderColor="border-emerald-200 dark:border-emerald-800"
                bgSurface="bg-emerald-50/50 dark:bg-emerald-950/30"
                title="Goals & Future State"
                description="Customer objectives and desired outcomes"
                value={opportunity.goalsHistory || ""}
                onSave={(value) => onFieldUpdate("goalsHistory", value)}
                placeholder="No goals recorded yet. Parse Gong transcripts to extract insights."
              />

              {/* Next Steps */}
              <InsightSection
                icon={ListChecks}
                iconColor="text-blue-500"
                bgColor="bg-blue-500/10"
                borderColor="border-blue-200 dark:border-blue-800"
                bgSurface="bg-blue-50/50 dark:bg-blue-950/30"
                title="Next Steps"
                description="Action items and follow-ups"
                value={opportunity.nextStepsHistory || ""}
                onSave={(value) => onFieldUpdate("nextStepsHistory", value)}
                placeholder="No next steps recorded yet. Parse Gong transcripts to extract insights."
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

interface InsightSectionProps {
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  bgSurface: string;
  title: string;
  description: string;
  value: string;
  onSave: (value: string | number | null) => Promise<void>;
  placeholder: string;
}

function InsightSection({
  icon: Icon,
  iconColor,
  bgColor,
  borderColor,
  bgSurface,
  title,
  description,
  value,
  onSave,
  placeholder,
}: InsightSectionProps) {
  return (
    <div className={cn("rounded-lg border p-4", borderColor, bgSurface)}>
      <div className="flex items-start gap-3 mb-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", bgColor)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <InlineTextarea
        label=""
        value={value}
        onSave={onSave}
        placeholder={placeholder}
        rows={6}
        className="bg-background/50 font-mono text-sm whitespace-pre-wrap"
      />
    </div>
  );
}
