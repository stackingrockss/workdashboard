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

interface Meeting {
  id: string;
  title: string;
  date: Date | string;
  type: "gong" | "granola" | "google";
  isParsed?: boolean;
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

  // Fetch available meetings for this opportunity
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        // Fetch Gong calls, Granola notes, and Google notes in parallel
        const [gongRes, granolaRes, googleRes] = await Promise.all([
          fetch(`/api/v1/opportunities/${opportunityId}/gong-calls`),
          fetch(`/api/v1/opportunities/${opportunityId}/granola-notes`),
          fetch(`/api/v1/opportunities/${opportunityId}/google-notes`),
        ]);

        const allMeetings: Meeting[] = [];

        if (gongRes.ok) {
          const gongData = await gongRes.json();
          const gongCalls = gongData.gongCalls || [];
          gongCalls.forEach((call: { id: string; title: string; meetingDate: string; parsingStatus?: string }) => {
            allMeetings.push({
              id: call.id,
              title: call.title,
              date: call.meetingDate,
              type: "gong",
              isParsed: call.parsingStatus === "completed",
            });
          });
        }

        if (granolaRes.ok) {
          const granolaData = await granolaRes.json();
          const granolaNotes = granolaData.granolaNotes || [];
          granolaNotes.forEach((note: { id: string; title: string; meetingDate: string; parsingStatus?: string }) => {
            allMeetings.push({
              id: note.id,
              title: note.title,
              date: note.meetingDate,
              type: "granola",
              isParsed: note.parsingStatus === "completed",
            });
          });
        }

        if (googleRes.ok) {
          const googleData = await googleRes.json();
          const googleNotes = googleData.googleNotes || [];
          googleNotes.forEach((note: { id: string; title: string; createdAt: string }) => {
            allMeetings.push({
              id: note.id,
              title: note.title,
              date: note.createdAt,
              type: "google",
              isParsed: false,
            });
          });
        }

        // Sort by date descending
        allMeetings.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setMeetings(allMeetings);

        // Auto-select parsed meetings if none selected yet
        if (
          value.gongCallIds.length === 0 &&
          value.granolaNoteIds.length === 0
        ) {
          const parsedGong = allMeetings
            .filter((m) => m.type === "gong" && m.isParsed)
            .map((m) => m.id);
          const parsedGranola = allMeetings
            .filter((m) => m.type === "granola" && m.isParsed)
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
        <p className="text-xs text-muted-foreground">
          {formatDateShort(meeting.date)}
          {meeting.isParsed && (
            <span className="ml-1 text-green-600">(parsed)</span>
          )}
        </p>
      </div>
    </div>
  );
};
