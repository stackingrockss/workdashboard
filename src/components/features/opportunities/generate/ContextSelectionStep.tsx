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
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ContentBrief, ContextSelection, ReferenceContent } from "@/types/brief";
import { Content, CONTENT_TYPE_LABELS } from "@/types/content";
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
  Zap,
  Info,
  FileCode,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RichTextViewer } from "@/components/ui/rich-text-editor";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTokenEstimate } from "@/hooks/useTokenEstimate";

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

interface ReferenceDocument {
  id: string;
  title: string;
  category: string;
  updatedAt: Date | string;
  createdBy?: {
    name: string | null;
  };
}

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

  // Reference documents state (opportunity-level)
  const [documents, setDocuments] = useState<ReferenceDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentSearch, setDocumentSearch] = useState("");

  // Content library state (org-level)
  const [orgContents, setOrgContents] = useState<Content[]>([]);
  const [orgContentsLoading, setOrgContentsLoading] = useState(true);
  const [contentSearch, setContentSearch] = useState("");

  // Token estimation hook
  const {
    estimate: tokenEstimate,
    loading: tokenLoading,
    totalFormatted,
    percentageOfLimit,
    usageColor,
    meetingTokens,
  } = useTokenEstimate({
    opportunityId,
    briefId: selectedBrief.id,
    contextSelection,
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

  // Fetch documents from Content tab
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch(
          `/api/v1/opportunities/${opportunityId}/documents?limit=50`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch documents");
        }

        const data = await response.json();
        setDocuments(data.documents || []);
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setDocumentsLoading(false);
      }
    };

    fetchDocuments();
  }, [opportunityId]);

  // Fetch org-wide content library
  useEffect(() => {
    const fetchOrgContents = async () => {
      try {
        const response = await fetch("/api/v1/content?limit=100");
        if (response.ok) {
          const data = await response.json();
          setOrgContents(data.contents || []);
        }
      } catch (error) {
        console.error("Failed to fetch org contents:", error);
      } finally {
        setOrgContentsLoading(false);
      }
    };

    fetchOrgContents();
  }, []);

  // Pre-populate brief's reference content IDs on mount
  useEffect(() => {
    if (selectedBrief.referenceContents && selectedBrief.referenceContents.length > 0) {
      const briefContentIds = selectedBrief.referenceContents.map((c) => c.id);
      // Merge with any existing selections, avoiding duplicates
      const existingIds = contextSelection.referenceContentIds || [];
      const mergedIds = [...new Set([...briefContentIds, ...existingIds])];
      if (mergedIds.length !== existingIds.length) {
        onContextChange({
          ...contextSelection,
          referenceContentIds: mergedIds,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrief.referenceContents]);

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

  // Filter documents by search
  const filteredDocuments = useMemo(() => {
    if (!documentSearch) return documents;
    return documents.filter((doc) =>
      doc.title.toLowerCase().includes(documentSearch.toLowerCase())
    );
  }, [documents, documentSearch]);

  // Reference document selection handlers
  const selectedReferenceIds = contextSelection.referenceDocumentIds || [];
  const referenceCount = selectedReferenceIds.length;

  const toggleDocument = (docId: string) => {
    const newIds = selectedReferenceIds.includes(docId)
      ? selectedReferenceIds.filter((id) => id !== docId)
      : [...selectedReferenceIds, docId];
    onContextChange({ ...contextSelection, referenceDocumentIds: newIds });
  };

  const handleClearDocuments = () => {
    onContextChange({ ...contextSelection, referenceDocumentIds: [] });
  };

  // Filter org content by search
  const filteredOrgContents = useMemo(() => {
    if (!contentSearch) return orgContents;
    return orgContents.filter((content) =>
      content.title.toLowerCase().includes(contentSearch.toLowerCase())
    );
  }, [orgContents, contentSearch]);

  // Content library selection handlers
  const selectedContentIds = contextSelection.referenceContentIds || [];
  const contentCount = selectedContentIds.length;
  const briefContentIds = selectedBrief.referenceContents?.map((c) => c.id) || [];

  const toggleOrgContent = (contentId: string) => {
    const newIds = selectedContentIds.includes(contentId)
      ? selectedContentIds.filter((id) => id !== contentId)
      : [...selectedContentIds, contentId];
    onContextChange({ ...contextSelection, referenceContentIds: newIds });
  };

  const handleClearOrgContents = () => {
    onContextChange({ ...contextSelection, referenceContentIds: [] });
  };

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
                                estimatedTokens={meetingTokens.get(meeting.id)}
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

              {/* Full transcripts toggle */}
              {selectedCount > 0 && (
                <div className="pt-3 mt-3 border-t">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="includeMeetingTranscripts"
                      checked={contextSelection.includeMeetingTranscripts || false}
                      onCheckedChange={(checked) =>
                        onContextChange({
                          ...contextSelection,
                          includeMeetingTranscripts: checked === true,
                        })
                      }
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="includeMeetingTranscripts"
                        className="cursor-pointer"
                      >
                        Include full transcripts
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {contextSelection.includeMeetingTranscripts
                          ? "Full meeting transcripts will be sent to AI (higher token usage)"
                          : "Only extracted insights (pain points, goals, quotes, etc.) will be used"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reference Examples section - Content Library */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Content Library
                  {contentCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {contentCount} selected
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearOrgContents}
                  disabled={contentCount === 0}
                  className="text-xs"
                >
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Select content from your organization library as reference examples.
              </p>
              {/* Search */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search content library..."
                  value={contentSearch}
                  onChange={(e) => setContentSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {orgContentsLoading ? (
                <div className="py-6 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading content library...
                </div>
              ) : orgContents.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <FileCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No content in your library</p>
                  <p className="text-xs mt-1">
                    Add content in the Content page to use as references.
                  </p>
                </div>
              ) : filteredOrgContents.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No content matches your search</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px] pr-4">
                  <div className="space-y-1">
                    {filteredOrgContents.map((content) => (
                      <ContentItem
                        key={content.id}
                        content={content}
                        isSelected={selectedContentIds.includes(content.id)}
                        isFromBrief={briefContentIds.includes(content.id)}
                        onToggle={() => toggleOrgContent(content.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Opportunity Documents section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Opportunity Documents
                  {referenceCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {referenceCount} selected
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearDocuments}
                  disabled={referenceCount === 0}
                  className="text-xs"
                >
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Select documents from this opportunity as additional references.
              </p>
              {/* Search */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={documentSearch}
                  onChange={(e) => setDocumentSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="py-6 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading documents...
                </div>
              ) : documents.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No documents in this opportunity</p>
                  <p className="text-xs mt-1">
                    Generate or create documents to use as references.
                  </p>
                </div>
              ) : filteredDocuments.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No documents match your search</p>
                </div>
              ) : (
                <ScrollArea className="h-[200px] pr-4">
                  <div className="space-y-1">
                    {filteredDocuments.map((doc) => (
                      <DocumentItem
                        key={doc.id}
                        document={doc}
                        isSelected={selectedReferenceIds.includes(doc.id)}
                        onToggle={() => toggleDocument(doc.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
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
              {/* Token usage estimate */}
              <TooltipProvider>
                <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Token Usage
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs">
                            Estimated tokens to be sent to Gemini. More context
                            = richer output but higher cost. Gemini 1.5 Pro
                            supports up to 2M tokens.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex items-center gap-2">
                      {tokenLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : (
                        <span className={cn("text-sm font-semibold", usageColor)}>
                          {totalFormatted}
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress
                    value={Math.min(percentageOfLimit, 100)}
                    className="h-1.5"
                  />
                  <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                    <span>{percentageOfLimit.toFixed(1)}% of limit</span>
                    <span>
                      {tokenEstimate?.modelLimits?.inputLimitFormatted || "2M"} max
                    </span>
                  </div>

                  {/* Token breakdown */}
                  {tokenEstimate && !tokenLoading && (
                    <Collapsible className="mt-3">
                      <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronRight className="h-3 w-3" />
                        View breakdown
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2 space-y-1">
                        <TokenBreakdownRow
                          label="Brief template"
                          tokens={tokenEstimate.brief.total}
                        />
                        <TokenBreakdownRow
                          label="Opportunity info"
                          tokens={tokenEstimate.context.opportunity}
                        />
                        {tokenEstimate.context.account > 0 && (
                          <TokenBreakdownRow
                            label="Account info"
                            tokens={tokenEstimate.context.account}
                          />
                        )}
                        {tokenEstimate.context.contacts > 0 && (
                          <TokenBreakdownRow
                            label="Contacts"
                            tokens={tokenEstimate.context.contacts}
                          />
                        )}
                        {tokenEstimate.context.consolidatedInsights > 0 && (
                          <TokenBreakdownRow
                            label="Consolidated insights"
                            tokens={tokenEstimate.context.consolidatedInsights}
                          />
                        )}
                        {tokenEstimate.context.meetings > 0 && (
                          <TokenBreakdownRow
                            label={`Meetings (${tokenEstimate.meetings.length})`}
                            tokens={tokenEstimate.context.meetings}
                          />
                        )}
                        {tokenEstimate.context.accountResearch > 0 && (
                          <TokenBreakdownRow
                            label="Account research"
                            tokens={tokenEstimate.context.accountResearch}
                          />
                        )}
                        {tokenEstimate.context.additionalContext > 0 && (
                          <TokenBreakdownRow
                            label="Additional context"
                            tokens={tokenEstimate.context.additionalContext}
                          />
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </TooltipProvider>

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
                  {contentCount > 0 && (
                    <Badge variant="secondary">
                      {contentCount} Content{contentCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {referenceCount > 0 && (
                    <Badge variant="secondary">
                      {referenceCount} Document{referenceCount !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {selectedCount === 0 &&
                    !contextSelection.includeConsolidatedInsights &&
                    !contextSelection.includeAccountResearch &&
                    !contextSelection.additionalContext &&
                    contentCount === 0 &&
                    referenceCount === 0 && (
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
                    <div className="text-sm">
                      <RichTextViewer content={selectedBrief.outputFormat} />
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
  estimatedTokens?: number;
}

// Token breakdown row component
interface TokenBreakdownRowProps {
  label: string;
  tokens: number;
}

const TokenBreakdownRow = ({ label, tokens }: TokenBreakdownRowProps) => {
  const formatTokens = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatTokens(tokens)}</span>
    </div>
  );
};

const MeetingItem = ({ meeting, isSelected, onToggle, estimatedTokens }: MeetingItemProps) => {
  const formatTokens = (n: number): string => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

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
      {isSelected && estimatedTokens !== undefined && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
          ~{formatTokens(estimatedTokens)}
        </Badge>
      )}
    </div>
  );
};

// Document item component for reference examples
interface DocumentItemProps {
  document: ReferenceDocument;
  isSelected: boolean;
  onToggle: () => void;
}

const DocumentItem = ({ document, isSelected, onToggle }: DocumentItemProps) => {
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
        <p className="text-sm truncate font-medium">{document.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDateShort(document.updatedAt)}</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 capitalize"
          >
            {document.category.replace(/_/g, " ")}
          </Badge>
          {document.createdBy?.name && (
            <span className="truncate">by {document.createdBy.name}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Content item component for org-wide content library
interface ContentItemProps {
  content: Content;
  isSelected: boolean;
  isFromBrief: boolean;
  onToggle: () => void;
}

const ContentItem = ({ content, isSelected, isFromBrief, onToggle }: ContentItemProps) => {
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
        <div className="flex items-center gap-2">
          <p className="text-sm truncate font-medium">{content.title}</p>
          {isFromBrief && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary"
            >
              From brief
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4"
          >
            {CONTENT_TYPE_LABELS[content.contentType] || content.contentType}
          </Badge>
          {content.description && (
            <span className="truncate">{content.description}</span>
          )}
        </div>
      </div>
    </div>
  );
};
