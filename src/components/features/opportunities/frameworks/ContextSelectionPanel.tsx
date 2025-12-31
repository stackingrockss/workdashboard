"use client";

import { useState, useEffect } from "react";
import { ContextSelection } from "@/types/framework";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Phone, FileText, Folder, Brain } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MeetingInsights {
  painPoints: number;
  goals: number;
  nextSteps: number;
  whyAndWhyNow: number;
  metrics: number;
}

interface Meeting {
  id: string;
  title: string;
  date: Date | string;
  type: "gong" | "granola" | "google";
  isParsed?: boolean;
  insights?: MeetingInsights;
}

interface ContextSelectionPanelProps {
  opportunityId: string;
  value: ContextSelection;
  onChange: (selection: ContextSelection) => void;
  hasAccountResearch?: boolean;
  hasConsolidatedInsights?: boolean;
}

export const ContextSelectionPanel = ({
  opportunityId,
  value,
  onChange,
  hasAccountResearch = false,
  hasConsolidatedInsights = false,
}: ContextSelectionPanelProps) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    meetings: true,
    insights: true,
    additional: true,
  });

  // Fetch available meetings for this opportunity using the timeline API
  // Timeline API fetches CalendarEvents with linked Gong/Granola records
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        // Use the timeline API which properly fetches meetings via CalendarEvents
        const response = await fetch(
          `/api/v1/opportunities/${opportunityId}/timeline`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch timeline");
        }

        const data = await response.json();
        const events = data.events || [];

        const allMeetings: Meeting[] = [];

        // Helper to count array length safely
        const countInsights = (arr: unknown): number =>
          Array.isArray(arr) ? arr.length : 0;

        // Extract Gong calls and Granola notes from timeline events
        // Timeline API returns events with linkedGongCall and linkedGranolaNote fields
        events.forEach((event: {
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
                whyAndWhyNow: 0,
                metrics: 0,
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
                whyAndWhyNow: 0,
                metrics: 0,
              },
            });
          }
        });

        // Sort by date descending
        allMeetings.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setMeetings(allMeetings);

        // Auto-select the 5 most recent parsed meetings if none selected yet
        // Meetings are already sorted by date descending
        if (
          value.gongCallIds.length === 0 &&
          value.granolaNoteIds.length === 0
        ) {
          const parsedMeetings = allMeetings.filter((m) => m.isParsed);
          const topFive = parsedMeetings.slice(0, 5);

          const parsedGong = topFive
            .filter((m) => m.type === "gong")
            .map((m) => m.id);
          const parsedGranola = topFive
            .filter((m) => m.type === "granola")
            .map((m) => m.id);

          if (parsedGong.length > 0 || parsedGranola.length > 0) {
            onChange({
              ...value,
              gongCallIds: parsedGong,
              granolaNoteIds: parsedGranola,
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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleMeeting = (meeting: Meeting) => {
    if (meeting.type === "gong") {
      const newIds = value.gongCallIds.includes(meeting.id)
        ? value.gongCallIds.filter((id) => id !== meeting.id)
        : [...value.gongCallIds, meeting.id];
      onChange({ ...value, gongCallIds: newIds });
    } else if (meeting.type === "granola") {
      const newIds = value.granolaNoteIds.includes(meeting.id)
        ? value.granolaNoteIds.filter((id) => id !== meeting.id)
        : [...value.granolaNoteIds, meeting.id];
      onChange({ ...value, granolaNoteIds: newIds });
    } else if (meeting.type === "google") {
      const newIds = value.googleNoteIds.includes(meeting.id)
        ? value.googleNoteIds.filter((id) => id !== meeting.id)
        : [...value.googleNoteIds, meeting.id];
      onChange({ ...value, googleNoteIds: newIds });
    }
  };

  const isMeetingSelected = (meeting: Meeting) => {
    if (meeting.type === "gong") return value.gongCallIds.includes(meeting.id);
    if (meeting.type === "granola")
      return value.granolaNoteIds.includes(meeting.id);
    if (meeting.type === "google")
      return value.googleNoteIds.includes(meeting.id);
    return false;
  };

  const selectedMeetingsCount =
    value.gongCallIds.length +
    value.granolaNoteIds.length +
    value.googleNoteIds.length;

  const gongMeetings = meetings.filter((m) => m.type === "gong");
  const granolaMeetings = meetings.filter((m) => m.type === "granola");
  const googleMeetings = meetings.filter((m) => m.type === "google");

  const handleSelectAll = () => {
    onChange({
      ...value,
      gongCallIds: gongMeetings.map((m) => m.id),
      granolaNoteIds: granolaMeetings.map((m) => m.id),
      googleNoteIds: googleMeetings.map((m) => m.id),
    });
  };

  const handleClearAll = () => {
    onChange({
      ...value,
      gongCallIds: [],
      granolaNoteIds: [],
      googleNoteIds: [],
    });
  };

  const allSelected =
    meetings.length > 0 && selectedMeetingsCount === meetings.length;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm">Context we&apos;ll write with:</h3>

      {/* Meetings Section */}
      <Collapsible
        open={expandedSections.meetings}
        onOpenChange={() => toggleSection("meetings")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Meetings</span>
            <span className="text-xs text-muted-foreground">
              ({meetings.length})
            </span>
            {selectedMeetingsCount > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                {selectedMeetingsCount} selected
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expandedSections.meetings && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground pl-6">Loading...</p>
          ) : meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-6">
              No meetings available
            </p>
          ) : (
            <>
              {/* Select All / Clear All buttons */}
              <div className="flex items-center gap-2 pl-6 pb-1">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={allSelected}
                  className={cn(
                    "text-xs px-2 py-1 rounded border transition-colors",
                    allSelected
                      ? "text-muted-foreground border-muted cursor-not-allowed"
                      : "text-primary border-primary/30 hover:bg-primary/10"
                  )}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={selectedMeetingsCount === 0}
                  className={cn(
                    "text-xs px-2 py-1 rounded border transition-colors",
                    selectedMeetingsCount === 0
                      ? "text-muted-foreground border-muted cursor-not-allowed"
                      : "text-muted-foreground border-muted-foreground/30 hover:bg-muted"
                  )}
                >
                  Clear All
                </button>
              </div>

              {/* Gong Calls */}
              {gongMeetings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground pl-6">
                    Gong Calls
                  </p>
                  {gongMeetings.map((meeting) => (
                    <MeetingItem
                      key={meeting.id}
                      meeting={meeting}
                      isSelected={isMeetingSelected(meeting)}
                      onToggle={() => toggleMeeting(meeting)}
                    />
                  ))}
                </div>
              )}

              {/* Granola Notes */}
              {granolaMeetings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground pl-6">
                    Granola Notes
                  </p>
                  {granolaMeetings.map((meeting) => (
                    <MeetingItem
                      key={meeting.id}
                      meeting={meeting}
                      isSelected={isMeetingSelected(meeting)}
                      onToggle={() => toggleMeeting(meeting)}
                    />
                  ))}
                </div>
              )}

              {/* Google Notes */}
              {googleMeetings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground pl-6">
                    Google Notes
                  </p>
                  {googleMeetings.map((meeting) => (
                    <MeetingItem
                      key={meeting.id}
                      meeting={meeting}
                      isSelected={isMeetingSelected(meeting)}
                      onToggle={() => toggleMeeting(meeting)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Insights Section */}
      <Collapsible
        open={expandedSections.insights}
        onOpenChange={() => toggleSection("insights")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">AI Insights</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expandedSections.insights && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2 pl-6">
          {/* Consolidated Insights */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="consolidatedInsights"
              checked={value.includeConsolidatedInsights}
              onCheckedChange={(checked) =>
                onChange({
                  ...value,
                  includeConsolidatedInsights: checked === true,
                })
              }
              disabled={!hasConsolidatedInsights}
            />
            <Label
              htmlFor="consolidatedInsights"
              className={cn(
                "text-sm cursor-pointer",
                !hasConsolidatedInsights && "text-muted-foreground"
              )}
            >
              Consolidated Call Insights
              {!hasConsolidatedInsights && (
                <span className="text-xs ml-1">(not available)</span>
              )}
            </Label>
          </div>

          {/* Account Research */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="accountResearch"
              checked={value.includeAccountResearch}
              onCheckedChange={(checked) =>
                onChange({
                  ...value,
                  includeAccountResearch: checked === true,
                })
              }
              disabled={!hasAccountResearch}
            />
            <Label
              htmlFor="accountResearch"
              className={cn(
                "text-sm cursor-pointer",
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
          {selectedMeetingsCount > 0 && (
            <div className="pt-2 mt-2 border-t">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="includeMeetingTranscripts"
                  checked={value.includeMeetingTranscripts || false}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...value,
                      includeMeetingTranscripts: checked === true,
                    })
                  }
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="includeMeetingTranscripts"
                    className="text-sm cursor-pointer"
                  >
                    Include full transcripts
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {value.includeMeetingTranscripts
                      ? "Full transcripts included (higher token usage)"
                      : "Using extracted insights only"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Additional Context */}
      <Collapsible
        open={expandedSections.additional}
        onOpenChange={() => toggleSection("additional")}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Additional Context</span>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expandedSections.additional && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              This is optional, and increases your content quality.
            </p>
            <Textarea
              placeholder="Add any additional context, research, or key points to consider..."
              value={value.additionalContext || ""}
              onChange={(e) =>
                onChange({ ...value, additionalContext: e.target.value })
              }
              rows={4}
              className="resize-none text-sm"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

// Sub-component for meeting item
interface MeetingItemProps {
  meeting: Meeting;
  isSelected: boolean;
  onToggle: () => void;
}

const MeetingItem = ({ meeting, isSelected, onToggle }: MeetingItemProps) => {
  // Build insight summary string
  const getInsightSummary = () => {
    if (!meeting.insights) return null;
    const { painPoints, goals, nextSteps, whyAndWhyNow, metrics } = meeting.insights;
    const total = painPoints + goals + nextSteps + whyAndWhyNow + metrics;
    if (total === 0) return null;

    const parts: string[] = [];
    if (painPoints > 0) parts.push(`${painPoints} pain`);
    if (goals > 0) parts.push(`${goals} goal${goals > 1 ? "s" : ""}`);
    if (whyAndWhyNow > 0) parts.push(`${whyAndWhyNow} driver${whyAndWhyNow > 1 ? "s" : ""}`);
    if (metrics > 0) parts.push(`${metrics} metric${metrics > 1 ? "s" : ""}`);
    if (nextSteps > 0) parts.push(`${nextSteps} next step${nextSteps > 1 ? "s" : ""}`);

    return parts.slice(0, 3).join(", ") + (parts.length > 3 ? "..." : "");
  };

  const insightSummary = getInsightSummary();

  return (
    <div
      className={cn(
        "flex items-center gap-2 pl-6 py-1.5 rounded cursor-pointer hover:bg-muted/50",
        isSelected && "bg-primary/5"
      )}
      onClick={onToggle}
    >
      <Checkbox checked={isSelected} onCheckedChange={() => onToggle()} />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{meeting.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDateShort(meeting.date)}</span>
          {meeting.isParsed && (
            <span className="text-green-600">(parsed)</span>
          )}
          {insightSummary && (
            <span className="text-primary/70">• {insightSummary}</span>
          )}
        </div>
      </div>
    </div>
  );
};
