import { CalendarEvent } from "@/types/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, Video, MapPin, ExternalLink } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import Link from "next/link";

interface CalendarEventCardProps {
  event: CalendarEvent;
  showLinkActions?: boolean;
  onLink?: (eventId: string, type: "account" | "opportunity", id: string) => void;
}

/**
 * CalendarEventCard - Displays a single calendar event with key details
 *
 * Used in:
 * - Dashboard "Upcoming Meetings" widget
 * - Opportunity detail "Related Calendar Events" section
 * - Account detail "Meeting History" section
 */
export function CalendarEventCard({
  event,
  showLinkActions = false,
  onLink,
}: CalendarEventCardProps) {
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getDuration = () => {
    const durationMs = endTime.getTime() - startTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ""}`;
    }
    return `${minutes}m`;
  };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header: Title and External Badge */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base line-clamp-2 flex-1">
              {event.summary}
            </h3>
            {event.isExternal && (
              <Badge variant="secondary" className="shrink-0">
                External
              </Badge>
            )}
          </div>

          {/* Date and Time */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formatDateShort(startTime.toISOString())}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>
                {formatTime(startTime)} - {formatTime(endTime)} ({getDuration()})
              </span>
            </div>
          </div>

          {/* Attendees */}
          {event.attendees.length > 0 && (
            <div className="flex items-start gap-1.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <span className="text-muted-foreground">
                  {event.attendees.slice(0, 3).join(", ")}
                  {event.attendees.length > 3 &&
                    ` +${event.attendees.length - 3} more`}
                </span>
              </div>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}

          {/* Meeting URL */}
          {event.meetingUrl && (
            <div className="flex items-center gap-1.5">
              <Video className="h-4 w-4 text-muted-foreground" />
              <a
                href={event.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Join Meeting
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Description (truncated) */}
          {event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Linked Opportunity */}
          {event.opportunityId && (
            <div className="pt-2 border-t">
              <Link
                href={`/opportunities/${event.opportunityId}`}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View Linked Opportunity
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}

          {/* Link Actions */}
          {showLinkActions && !event.opportunityId && onLink && (
            <div className="pt-2 border-t flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Link to:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLink(event.id, "opportunity", "")}
              >
                Opportunity
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLink(event.id, "account", "")}
              >
                Account
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
