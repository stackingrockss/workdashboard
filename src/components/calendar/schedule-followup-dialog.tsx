"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const scheduleFollowupSchema = z.object({
  summary: z.string().min(1, "Event title is required").max(1024),
  description: z.string().max(8192).optional(),
  location: z.string().max(512).optional(),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  duration: z.string().min(1, "Duration is required"),
});

type ScheduleFollowupInput = z.infer<typeof scheduleFollowupSchema>;

interface ScheduleFollowupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  opportunityName: string;
  contactEmails?: string[];
  onSuccess?: () => void;
}

/**
 * ScheduleFollowupDialog - Create a follow-up meeting for an opportunity
 *
 * Features:
 * - Pre-fills title with opportunity name
 * - Auto-adds opportunity contacts as attendees
 * - Creates Google Calendar event with Meet link
 * - Links event to opportunity
 * - Default reminders (1 day before, 1 hour before)
 */
export function ScheduleFollowupDialog({
  open,
  onOpenChange,
  opportunityId,
  opportunityName,
  contactEmails = [],
  onSuccess,
}: ScheduleFollowupDialogProps) {
  const [creating, setCreating] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ScheduleFollowupInput>({
    resolver: zodResolver(scheduleFollowupSchema),
    defaultValues: {
      summary: `Follow-up: ${opportunityName}`,
      duration: "60", // 60 minutes default
    },
  });

  const onSubmit = async (data: ScheduleFollowupInput) => {
    setCreating(true);

    try {
      // Calculate start and end times
      const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
      const endDateTime = new Date(
        startDateTime.getTime() + parseInt(data.duration) * 60 * 1000
      );

      // Create event payload
      const eventPayload = {
        summary: data.summary,
        description: data.description,
        location: data.location,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        attendees: contactEmails,
        opportunityId,
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup" as const, minutes: 60 }, // 1 hour before
            { method: "popup" as const, minutes: 1440 }, // 1 day before
          ],
        },
        sendUpdates: "all" as const, // Send invites to attendees
      };

      const response = await fetch(
        "/api/v1/integrations/google/calendar/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventPayload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.error?.includes("not connected")) {
          toast.error(
            "Calendar not connected. Please connect Google Calendar in Settings."
          );
          return;
        }
        throw new Error(result.error || "Failed to create event");
      }

      toast.success("Follow-up meeting scheduled successfully!");
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to schedule follow-up:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to schedule follow-up meeting"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Follow-up Meeting
          </DialogTitle>
          <DialogDescription>
            Create a calendar event for {opportunityName}
            {contactEmails.length > 0 &&
              ` with ${contactEmails.length} contact${contactEmails.length > 1 ? "s" : ""}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor="summary">Event Title *</Label>
            <Input
              id="summary"
              {...register("summary")}
              placeholder="e.g. Follow-up: Acme Corp"
            />
            {errors.summary && (
              <p className="text-sm text-destructive">
                {errors.summary.message}
              </p>
            )}
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Date *</Label>
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
                min={new Date().toISOString().split("T")[0]}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Time *</Label>
              <Input id="startTime" type="time" {...register("startTime")} />
              {errors.startTime && (
                <p className="text-sm text-destructive">
                  {errors.startTime.message}
                </p>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes) *</Label>
            <Input
              id="duration"
              type="number"
              {...register("duration")}
              min="15"
              step="15"
              placeholder="60"
            />
            {errors.duration && (
              <p className="text-sm text-destructive">
                {errors.duration.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Meeting agenda, topics to discuss..."
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              {...register("location")}
              placeholder="Office, Zoom, etc. (Google Meet link added automatically)"
            />
            {errors.location && (
              <p className="text-sm text-destructive">
                {errors.location.message}
              </p>
            )}
          </div>

          {/* Attendees Info */}
          {contactEmails.length > 0 && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Attendees:</p>
              <ul className="text-muted-foreground space-y-0.5">
                {contactEmails.slice(0, 3).map((email) => (
                  <li key={email}>• {email}</li>
                ))}
                {contactEmails.length > 3 && (
                  <li>• +{contactEmails.length - 3} more</li>
                )}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                "Schedule Meeting"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
