"use client";

// Individual timeline event card component
// Displays Gong calls and Granola notes with type-specific details

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, StickyNote, ExternalLink, Eye, Loader2 } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import type { TimelineEvent } from "@/types/timeline";

interface TimelineEventCardProps {
  event: TimelineEvent;
  position: "left" | "right";
  onViewInsights?: (callId: string) => void;
}

export function TimelineEventCard({
  event,
  position,
  onViewInsights,
}: TimelineEventCardProps) {
  const isGongCall = event.type === "gong_call";

  // Type-specific styling
  const iconBgColor = isGongCall ? "bg-blue-100 dark:bg-blue-900" : "bg-green-100 dark:bg-green-900";
  const iconColor = isGongCall ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400";

  return (
    <div
      className={`flex items-center gap-4 ${
        position === "left" ? "flex-row" : "flex-row-reverse"
      }`}
    >
      {/* Timeline dot and icon */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-10 h-10 rounded-full ${iconBgColor} flex items-center justify-center ${iconColor} z-10 relative`}
        >
          {isGongCall ? (
            <Phone className="h-5 w-5" />
          ) : (
            <StickyNote className="h-5 w-5" />
          )}
        </div>
      </div>

      {/* Event card */}
      <Card
        className={`flex-1 p-4 hover:shadow-md transition-shadow ${
          position === "left" ? "mr-8" : "ml-8"
        }`}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="font-semibold text-base leading-tight">
                {event.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDateShort(event.date.toString())}
              </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 items-start">
              {event.noteType && (
                <Badge variant="outline" className="text-xs">
                  {event.noteType}
                </Badge>
              )}

              {isGongCall && event.parsingStatus && (
                <Badge
                  variant={
                    event.parsingStatus === "completed"
                      ? "default"
                      : event.parsingStatus === "failed"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-xs"
                >
                  {event.parsingStatus === "parsing" && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  {event.parsingStatus}
                </Badge>
              )}
            </div>
          </div>

          {/* Gong call-specific content */}
          {isGongCall && event.parsingStatus === "completed" && (() => {
            // Safely extract and validate pain points
            const painPoints = Array.isArray(event.painPoints)
              ? (event.painPoints as string[]).filter(p => typeof p === 'string')
              : [];

            // Safely extract and validate next steps
            const nextSteps = Array.isArray(event.nextSteps)
              ? (event.nextSteps as string[]).filter(s => typeof s === 'string')
              : [];

            return (
              <div className="space-y-2 text-sm">
                {/* Pain points preview */}
                {painPoints.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Pain Points
                    </p>
                    <ul className="text-xs space-y-0.5 list-disc list-inside text-muted-foreground">
                      {painPoints.slice(0, 2).map((point, idx) => (
                        <li key={idx} className="line-clamp-1">
                          {point}
                        </li>
                      ))}
                      {painPoints.length > 2 && (
                        <li className="text-xs italic">
                          +{painPoints.length - 2} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Next steps preview */}
                {nextSteps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Next Steps
                    </p>
                    <ul className="text-xs space-y-0.5 list-disc list-inside text-muted-foreground">
                      {nextSteps.slice(0, 2).map((step, idx) => (
                        <li key={idx} className="line-clamp-1">
                          {step}
                        </li>
                      ))}
                      {nextSteps.length > 2 && (
                        <li className="text-xs italic">
                          +{nextSteps.length - 2} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              asChild
            >
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Open in {isGongCall ? "Gong" : "Granola"}
              </a>
            </Button>

            {isGongCall &&
              event.parsingStatus === "completed" &&
              onViewInsights && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onViewInsights(event.id)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View Insights
                </Button>
              )}
          </div>
        </div>
      </Card>
    </div>
  );
}
