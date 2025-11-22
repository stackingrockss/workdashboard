import { CalendarEvent } from "@/types/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users } from "lucide-react";
import { formatDateShort } from "@/lib/format";

interface CalendarEventCardProps {
  event: CalendarEvent;
}

/**
 * CalendarEventCard - Displays a simplified calendar event card
 *
 * Shows:
 * - Meeting title
 * - External badge (if applicable)
 * - Date and time with duration
 * - All attendees
 *
 * Used in:
 * - Dashboard "Upcoming Meetings" widget
 * - Opportunity detail "Related Calendar Events" section
 */
export function CalendarEventCard({ event }: CalendarEventCardProps) {
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
        </div>
      </CardContent>
    </Card>
  );
}
