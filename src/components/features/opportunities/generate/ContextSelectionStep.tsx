"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ContentBrief, ContextSelection } from "@/types/brief";
import {
  Search,
  ArrowLeft,
  Sparkles,
  Loader2,
  Phone,
  Brain,
  FileText,
  Calendar,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ContextSelectionStepProps {
  opportunityId: string;
  selectedBrief: ContentBrief;
  contextSelection: ContextSelection;
  onContextChange: (selection: ContextSelection) => void;
  hasAccountResearch?: boolean;
  hasConsolidatedInsights?: boolean;
  onBack: () => void;
  onGenerate: () => void;
  generating: boolean;
}

interface MeetingInsights {
  painPoints: number;
  goals: number;
  nextSteps: number;
}

interface Meeting {
  id: string;
  title: string;
  date: Date | string;
  type: "gong" | "granola" | "google";
  isParsed?: boolean;
  insights?: MeetingInsights;
}

type MeetingGroup = {
  label: string;
  meetings: Meeting[];
};

export const ContextSelectionStep = ({
  opportunityId,
  selectedBrief,
  contextSelection,
  onContextChange,
  hasAccountResearch = false,
  hasConsolidatedInsights = false,
  onBack,
  onGenerate,
  generating,
}: ContextSelectionStepProps) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingSearch, setMeetingSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    thisWeek: true,
    lastWeek: true,
    older: false,
  });

  // Fetch meetings from timeline API
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const response = await fetch(
          `/api/v1/opportunities/${opportunityId}/timeline`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch timeline");
        }

        const data = await response.json();
        const events = data.events || [];

        const allMeetings: Meeting[] = [];

        const countInsights = (arr: unknown): number =>
          Array.isArray(arr) ? arr.length : 0;

        events.forEach(
          (event: {
            linkedGongCall?: {
              id: string;
              title: string;
              parsingStatus?: string;
              painPoints?: unknown[];
              goals?: unknown[];
              nextSteps?: unknown[];
            } | null;
            linkedGranolaNote?: {
              id: string;
              title: string;
              parsingStatus?: string;
              painPoints?: unknown[];
              goals?: unknown[];
              nextSteps?: unknown[];
            } | null;
            date: string;
          }) => {
            if (event.linkedGongCall) {
              const call = event.linkedGongCall;
              allMeetings.push({
                id: call.id,
                title: call.title,
                date: event.date,
                type: "gong",
                isParsed: call.parsingStatus === "completed",
                insights: {
                  painPoints: countInsights(call.painPoints),
                  goals: countInsights(call.goals),
                  nextSteps: countInsights(call.nextSteps),
                },
              });
            }

            if (event.linkedGranolaNote) {
              const note = event.linkedGranolaNote;
              allMeetings.push({
                id: note.id,
                title: note.title,
                date: event.date,
                type: "granola",
                isParsed: note.parsingStatus === "completed",
                insights: {
                  painPoints: countInsights(note.painPoints),
                  goals: countInsights(note.goals),
                  nextSteps: countInsights(note.nextSteps),
                },
              });
            }
          }
        );

        // Sort by date descending
        allMeetings.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setMeetings(allMeetings);

        // Auto-select top 5 parsed meetings if none selected
        if (
          contextSelection.gongCallIds.length === 0 &&
          contextSelection.granolaNoteIds.length === 0
        ) {
          const parsedMeetings = allMeetings.filter((m) => m.isParsed);
          const topFive = parsedMeetings.slice(0, 5);

          const gongIds = topFive
            .filter((m) => m.type === "gong")
            .map((m) => m.id);
          const granolaIds = topFive
            .filter((m) => m.type === "granola")
            .map((m) => m.id);

          if (gongIds.length > 0 || granolaIds.length > 0) {
            onContextChange({
              ...contextSelection,
              gongCallIds: gongIds,
              granolaNoteIds: granolaIds,
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch meetings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, [opportunityId]);

  // Filter and group meetings
  const { filteredMeetings, groupedMeetings } = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Filter by search
    const filtered = meetingSearch
      ? meetings.filter((m) =>
          m.title.toLowerCase().includes(meetingSearch.toLowerCase())
        )
      : meetings;

    // Group by recency
    const groups: MeetingGroup[] = [
      {
        label: "This Week",
        meetings: filtered.filter((m) => new Date(m.date) >= oneWeekAgo),
      },
      {
        label: "Last Week",
        meetings: filtered.filter(
          (m) =>
            new Date(m.date) >= twoWeeksAgo && new Date(m.date) < oneWeekAgo
        ),
      },
      {
        label: "Older",
        meetings: filtered.filter((m) => new Date(m.date) < twoWeeksAgo),
      },
    ].filter((g) => g.meetings.length > 0);

    return { filteredMeetings: filtered, groupedMeetings: groups };
  }, [meetings, meetingSearch]);

  const toggleMeeting = (meeting: Meeting) => {
    if (meeting.type === "gong") {
      const newIds = contextSelection.gongCallIds.includes(meeting.id)
        ? contextSelection.gongCallIds.filter((id) => id !== meeting.id)
        : [...contextSelection.gongCallIds, meeting.id];
      onContextChange({ ...contextSelection, gongCallIds: newIds });
    } else if (meeting.type === "granola") {
      const newIds = contextSelection.granolaNoteIds.includes(meeting.id)
        ? contextSelection.granolaNoteIds.filter((id) => id !== meeting.id)
        : [...contextSelection.granolaNoteIds, meeting.id];
      onContextChange({ ...contextSelection, granolaNoteIds: newIds });
    } else if (meeting.type === "google") {
      const newIds = contextSelection.googleNoteIds.includes(meeting.id)
        ? contextSelection.googleNoteIds.filter((id) => id !== meeting.id)
        : [...contextSelection.googleNoteIds, meeting.id];
      onContextChange({ ...contextSelection, googleNoteIds: newIds });
    }
  };

  const isMeetingSelected = (meeting: Meeting) => {
    if (meeting.type === "gong")
      return contextSelection.gongCallIds.includes(meeting.id);
    if (meeting.type === "granola")
      return contextSelection.granolaNoteIds.includes(meeting.id);
    if (meeting.type === "google")
      return contextSelection.googleNoteIds.includes(meeting.id);
    return false;
  };

  const selectedCount =
    contextSelection.gongCallIds.length +
    contextSelection.granolaNoteIds.length +
    contextSelection.googleNoteIds.length;

  const handleSelectAll = () => {
    onContextChange({
      ...contextSelection,
      gongCallIds: meetings.filter((m) => m.type === "gong").map((m) => m.id),
      granolaNoteIds: meetings
        .filter((m) => m.type === "granola")
        .map((m) => m.id),
      googleNoteIds: meetings
        .filter((m) => m.type === "google")
        .map((m) => m.id),
    });
  };

  const handleClearAll = () => {
    onContextChange({
      ...contextSelection,
      gongCallIds: [],
      granolaNoteIds: [],
      googleNoteIds: [],
    });
  };

  // Parse sections for preview
  const selectedSections = Array.isArray(selectedBrief.sections)
    ? selectedBrief.sections
    : [];

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const getGroupKey = (label: string) =>
    label.toLowerCase().replace(/\s+/g, "");

  return (
    <div className="space-y-6">
      {/* Main content: Context selection + Template preview */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Context selection */}
        <div className="space-y-6">
          {/* Meetings section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Meetings
                  {selectedCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedCount} selected
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={selectedCount === meetings.length}
                    className="text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    disabled={selectedCount === 0}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              {/* Search */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search meetings..."
                  value={meetingSearch}
                  onChange={(e) => setMeetingSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading meetings...
                </div>
              ) : meetings.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No meetings found</p>
                </div>
              ) : filteredMeetings.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No meetings match your search</p>
                </div>
              ) : (
                <ScrollArea className="h-[320px] pr-4">
                  <div className="space-y-4">
                    {groupedMeetings.map((group) => {
                      const groupKey = getGroupKey(group.label);
                      const isExpanded = expandedGroups[groupKey] !== false;

                      return (
                        <Collapsible
                          key={group.label}
                          open={isExpanded}
                          onOpenChange={() => toggleGroup(groupKey)}
                        >
                          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {group.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({group.meetings.length})
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-1 pt-1">
                            {group.meetings.map((meeting) => (
                              <MeetingItem
                                key={meeting.id}
                                meeting={meeting}
                                isSelected={isMeetingSelected(meeting)}
                                onToggle={() => toggleMeeting(meeting)}
                              />
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* AI Insights section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="consolidatedInsights"
                  checked={contextSelection.includeConsolidatedInsights}
                  onCheckedChange={(checked) =>
                    onContextChange({
                      ...contextSelection,
                      includeConsolidatedInsights: checked === true,
                    })
                  }
                  disabled={!hasConsolidatedInsights}
                />
                <Label
                  htmlFor="consolidatedInsights"
                  className={cn(
                    "cursor-pointer",
                    !hasConsolidatedInsights && "text-muted-foreground"
                  )}
                >
                  Consolidated Call Insights
                  {!hasConsolidatedInsights && (
                    <span className="text-xs ml-1">(not available)</span>
                  )}
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="accountResearch"
                  checked={contextSelection.includeAccountResearch}
                  onCheckedChange={(checked) =>
                    onContextChange({
                      ...contextSelection,
                      includeAccountResearch: checked === true,
                    })
                  }
                  disabled={!hasAccountResearch}
                />
                <Label
                  htmlFor="accountResearch"
                  className={cn(
                    "cursor-pointer",
                    !hasAccountResearch && "text-muted-foreground"
                  )}
                >
                  Account Research
                  {!hasAccountResearch && (
                    <span className="text-xs ml-1">(not available)</span>
                  )}
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Additional context */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Additional Context
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any additional context, research, or key points to consider..."
                value={contextSelection.additionalContext || ""}
                onChange={(e) =>
                  onContextChange({
                    ...contextSelection,
                    additionalContext: e.target.value,
                  })
                }
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Optional: Include specific details, competitive intel, or
                guidance for the AI.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: Brief preview */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {selectedBrief.name}
              </CardTitle>
              {selectedBrief.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedBrief.description}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {/* Context summary */}
              <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-dashed">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  AI will use:
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedCount > 0 && (
                    <Badge variant="secondary">
                      {selectedCount} meeting{selectedCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {contextSelection.includeConsolidatedInsights &&
                    hasConsolidatedInsights && (
                      <Badge variant="secondary">Consolidated Insights</Badge>
                    )}
                  {contextSelection.includeAccountResearch &&
                    hasAccountResearch && (
                      <Badge variant="secondary">Account Research</Badge>
                    )}
                  {contextSelection.additionalContext && (
                    <Badge variant="secondary">Additional Context</Badge>
                  )}
                  {selectedCount === 0 &&
                    !contextSelection.includeConsolidatedInsights &&
                    !contextSelection.includeAccountResearch &&
                    !contextSelection.additionalContext && (
                      <span className="text-xs text-muted-foreground">
                        No context selected
                      </span>
                    )}
                </div>
              </div>

              {/* Sections preview */}
              {selectedSections.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Sections
                  </p>
                  <div className="space-y-1">
                    {selectedSections.map((section, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <span className="w-5 h-5 rounded bg-muted flex items-center justify-center text-xs">
                          {i + 1}
                        </span>
                        {section.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output template preview */}
              {selectedBrief.outputFormat && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Output Template
                  </p>
                  <ScrollArea className="h-[280px] rounded-md border bg-muted/30 p-3">
                    <div className="prose prose-sm dark:prose-invert prose-headings:text-sm prose-headings:font-medium prose-p:text-xs prose-p:text-muted-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedBrief.outputFormat}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button onClick={onGenerate} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Content
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

// Meeting item component
interface MeetingItemProps {
  meeting: Meeting;
  isSelected: boolean;
  onToggle: () => void;
}

const MeetingItem = ({ meeting, isSelected, onToggle }: MeetingItemProps) => {
  const getInsightSummary = () => {
    if (!meeting.insights) return null;
    const { painPoints, goals, nextSteps } = meeting.insights;
    const total = painPoints + goals + nextSteps;
    if (total === 0) return null;

    const parts: string[] = [];
    if (painPoints > 0) parts.push(`${painPoints} pain`);
    if (goals > 0) parts.push(`${goals} goal${goals > 1 ? "s" : ""}`);
    if (nextSteps > 0)
      parts.push(`${nextSteps} step${nextSteps > 1 ? "s" : ""}`);

    return parts.join(", ");
  };

  const insightSummary = getInsightSummary();

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected && "bg-primary/5 border border-primary/20"
      )}
      onClick={onToggle}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle()}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm truncate",
            meeting.isParsed && "font-medium"
          )}
        >
          {meeting.title}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDateShort(meeting.date)}</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 capitalize"
          >
            {meeting.type}
          </Badge>
          {meeting.isParsed && (
            <span className="text-green-600 dark:text-green-400">
              (parsed)
            </span>
          )}
          {insightSummary && (
            <span className="text-primary/70">• {insightSummary}</span>
          )}
        </div>
      </div>
    </div>
  );
};
