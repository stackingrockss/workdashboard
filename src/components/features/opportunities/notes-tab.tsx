"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  Calendar,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";
import { ConsolidatedInsightsCard } from "./consolidated-insights-card";
import { OpportunityUpdateInput } from "@/lib/validations/opportunity";
import { cn } from "@/lib/utils";
import type { RiskAssessment } from "@/types/gong-call";

// Parse date-prefixed insights into structured data
interface ParsedInsightEntry {
  date: string;
  formattedDate: string;
  items: string[];
}

function parseInsightsHistory(text: string): ParsedInsightEntry[] {
  if (!text) return [];

  const lines = text.split("\n");
  const entries: ParsedInsightEntry[] = [];
  let currentEntry: ParsedInsightEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip the header line
    if (trimmed.startsWith("--- Auto-generated")) continue;

    // Check if line is a date (MM/DD/YYYY format)
    const dateMatch = trimmed.match(/^(\d{2}\/\d{2}\/\d{4})$/);
    if (dateMatch) {
      if (currentEntry && currentEntry.items.length > 0) {
        entries.push(currentEntry);
      }
      const [month, day, year] = dateMatch[1].split("/");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      currentEntry = {
        date: dateMatch[1],
        formattedDate: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        items: [],
      };
    } else if (currentEntry && trimmed.startsWith("-")) {
      // It's a bullet point
      currentEntry.items.push(trimmed.substring(1).trim());
    }
  }

  // Don't forget the last entry
  if (currentEntry && currentEntry.items.length > 0) {
    entries.push(currentEntry);
  }

  return entries;
}

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
                borderColor="border-orange-200 dark:border-orange-900/50"
                bgSurface="bg-orange-50/50 dark:bg-orange-950/20"
                accentColor="bg-orange-500"
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
                borderColor="border-emerald-200 dark:border-emerald-900/50"
                bgSurface="bg-emerald-50/50 dark:bg-emerald-950/20"
                accentColor="bg-emerald-500"
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
                borderColor="border-blue-200 dark:border-blue-900/50"
                bgSurface="bg-blue-50/50 dark:bg-blue-950/20"
                accentColor="bg-blue-500"
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
  accentColor: string;
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
  accentColor,
  title,
  description,
  value,
  onSave,
  placeholder,
}: InsightSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Parse the text into structured entries
  const parsedEntries = useMemo(() => parseInsightsHistory(value), [value]);
  const hasContent = parsedEntries.length > 0;

  // Auto-expand the first entry
  useEffect(() => {
    if (parsedEntries.length > 0 && expandedDates.size === 0) {
      setExpandedDates(new Set([parsedEntries[0].date]));
    }
  }, [parsedEntries]);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editValue || null);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  return (
    <div className={cn("rounded-xl border overflow-hidden", borderColor)}>
      {/* Header */}
      <div className={cn("px-4 py-3 flex items-center justify-between", bgSurface)}>
        <div className="flex items-center gap-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", bgColor)}>
            <Icon className={cn("h-4 w-4", iconColor)} />
          </div>
          <div>
            <h4 className="font-semibold text-sm">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <Badge variant="secondary" className="text-xs">
              {parsedEntries.length} {parsedEntries.length === 1 ? "call" : "calls"}
            </Badge>
          )}
          {!isEditing ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-background">
        {isEditing ? (
          <div className="p-4">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              rows={12}
              className="font-mono text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Format: Date on its own line (MM/DD/YYYY), followed by bullet points starting with &quot;-&quot;
            </p>
          </div>
        ) : hasContent ? (
          <div className="divide-y divide-border">
            {parsedEntries.map((entry) => {
              const isExpanded = expandedDates.has(entry.date);
              return (
                <div key={entry.date} className="group">
                  {/* Date Header - Clickable */}
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                    onClick={() => toggleDate(entry.date)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                        "bg-muted/80 group-hover:bg-muted"
                      )}>
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <span className="font-medium text-sm">{entry.formattedDate}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {entry.items.length} {entry.items.length === 1 ? "insight" : "insights"}
                        </span>
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Items - Collapsible */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      <div className="ml-11 space-y-2">
                        {entry.items.map((item, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-start gap-2 p-2.5 rounded-lg text-sm",
                              "bg-muted/30 hover:bg-muted/50 transition-colors"
                            )}
                          >
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                              accentColor
                            )} />
                            <span className="text-foreground/90 leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-center">
            <Icon className={cn("h-8 w-8 mx-auto mb-2", iconColor, "opacity-30")} />
            <p className="text-sm text-muted-foreground">{placeholder}</p>
          </div>
        )}
      </div>
    </div>
  );
}
