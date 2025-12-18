"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Link as LinkIcon, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarEvent } from "@/types/calendar";
import { GongCall } from "@/types/gong-call";
import { GranolaNote } from "@/types/granola-note";
import { GongCallItem } from "./GongCallItem";
import { GranolaNoteItem } from "./GranolaNoteItem";
import { toast } from "sonner";

interface OrphanedNotesSectionProps {
  orphanedGongCalls: GongCall[];
  orphanedGranolaNotes: GranolaNote[];
  calendarEvents: CalendarEvent[];
  opportunityId: string;
  onRefresh?: () => void;
  onViewInsights?: (call: GongCall) => void;
  onParse?: (call: GongCall) => void;
}

/**
 * OrphanedNotesSection - Display Gong calls and Granola notes that are NOT linked to any calendar event
 *
 * Features:
 * - Collapsible section (collapsed by default)
 * - Shows count of orphaned notes in header (e.g., "3 Unlinked Notes")
 * - Dropdown for each note to manually select a calendar event to link
 * - Displays all existing Gong/Granola item functionality (delete, view insights, etc.)
 */
export function OrphanedNotesSection({
  orphanedGongCalls,
  orphanedGranolaNotes,
  calendarEvents,
  opportunityId,
  onRefresh,
  onViewInsights,
  onParse,
}: OrphanedNotesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [linkingNoteId, setLinkingNoteId] = useState<string | null>(null);

  const totalOrphaned = orphanedGongCalls.length + orphanedGranolaNotes.length;

  if (totalOrphaned === 0) {
    return null;
  }

  const handleLinkGongCall = async (callId: string, eventId: string) => {
    setLinkingNoteId(callId);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/gong-calls/${callId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: eventId }),
        }
      );

      if (!response.ok) throw new Error("Failed to link");

      toast.success("Gong call linked to meeting");
      onRefresh?.();
    } catch (error) {
      console.error("Failed to link Gong call:", error);
      toast.error("Failed to link Gong call");
    } finally {
      setLinkingNoteId(null);
    }
  };

  const handleLinkGranolaNote = async (noteId: string, eventId: string) => {
    setLinkingNoteId(noteId);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/granola-notes/${noteId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarEventId: eventId }),
        }
      );

      if (!response.ok) throw new Error("Failed to link");

      toast.success("Granola note linked to meeting");
      onRefresh?.();
    } catch (error) {
      console.error("Failed to link Granola note:", error);
      toast.error("Failed to link Granola note");
    } finally {
      setLinkingNoteId(null);
    }
  };

  return (
    <Card className="overflow-hidden border-dashed">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <h3 className="font-semibold text-sm">Unlinked Notes</h3>
            <Badge variant="secondary">{totalOrphaned}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Notes not associated with any calendar event
          </p>
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4 space-y-4 border-t">
          {/* Orphaned Gong Calls */}
          {orphanedGongCalls.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                🎥 Gong Calls ({orphanedGongCalls.length})
              </h4>
              <div className="space-y-3">
                {orphanedGongCalls.map((call) => (
                  <div key={call.id} className="space-y-2 p-2 bg-muted/30 rounded-md">
                    <GongCallItem
                      call={call}
                      opportunityId={opportunityId}
                      onDelete={onRefresh}
                      onViewInsights={onViewInsights}
                      onParse={onParse}
                    />
                    <div className="flex items-center gap-2 pl-2">
                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      <Select
                        onValueChange={(eventId) => handleLinkGongCall(call.id, eventId)}
                        disabled={linkingNoteId === call.id}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1">
                          {linkingNoteId === call.id ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Linking...
                            </div>
                          ) : (
                            <SelectValue placeholder="Link to meeting..." />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {calendarEvents.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">
                              No calendar events found
                            </div>
                          ) : (
                            calendarEvents.map((event) => (
                              <SelectItem key={event.id} value={event.id} className="text-xs">
                                {event.summary} -{" "}
                                {new Date(event.startTime).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orphaned Granola Notes */}
          {orphanedGranolaNotes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                📝 Granola Notes ({orphanedGranolaNotes.length})
              </h4>
              <div className="space-y-3">
                {orphanedGranolaNotes.map((note) => (
                  <div key={note.id} className="space-y-2 p-2 bg-muted/30 rounded-md">
                    <GranolaNoteItem
                      note={note}
                      opportunityId={opportunityId}
                      onDelete={onRefresh}
                    />
                    <div className="flex items-center gap-2 pl-2">
                      <LinkIcon className="h-4 w-4 text-muted-foreground" />
                      <Select
                        onValueChange={(eventId) => handleLinkGranolaNote(note.id, eventId)}
                        disabled={linkingNoteId === note.id}
                      >
                        <SelectTrigger className="h-8 text-xs flex-1">
                          {linkingNoteId === note.id ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Linking...
                            </div>
                          ) : (
                            <SelectValue placeholder="Link to meeting..." />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {calendarEvents.length === 0 ? (
                            <div className="p-2 text-xs text-muted-foreground">
                              No calendar events found
                            </div>
                          ) : (
                            calendarEvents.map((event) => (
                              <SelectItem key={event.id} value={event.id} className="text-xs">
                                {event.summary} -{" "}
                                {new Date(event.startTime).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
