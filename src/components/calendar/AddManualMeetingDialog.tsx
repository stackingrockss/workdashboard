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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter } from "next/navigation";

const manualMeetingSchema = z.object({
  summary: z.string().min(1, "Meeting title is required").max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  duration: z.string().min(1, "Duration is required"),
  meetingUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
});

type ManualMeetingInput = z.infer<typeof manualMeetingSchema>;

interface AddManualMeetingDialogProps {
  opportunityId: string;
  onMeetingAdded?: () => void;
}

export function AddManualMeetingDialog({
  opportunityId,
  onMeetingAdded,
}: AddManualMeetingDialogProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ManualMeetingInput>({
    resolver: zodResolver(manualMeetingSchema),
    defaultValues: {
      duration: "60",
    },
  });

  const onSubmit = async (data: ManualMeetingInput) => {
    setCreating(true);

    try {
      // Calculate start and end times
      const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
      const endDateTime = new Date(
        startDateTime.getTime() + parseInt(data.duration) * 60 * 1000
      );

      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/meetings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: data.summary,
            description: data.description || undefined,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            meetingUrl: data.meetingUrl || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create meeting");
      }

      toast.success("Meeting added successfully!");
      setOpen(false);
      reset();

      if (onMeetingAdded) {
        onMeetingAdded();
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to create meeting:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create meeting"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Add Manual Meeting
          </DialogTitle>
          <DialogDescription>
            Add a meeting that wasn&apos;t synced from your calendar
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="summary">Meeting Title *</Label>
            <Input
              id="summary"
              placeholder="e.g., Discovery Call with Acme Corp"
              {...register("summary")}
              disabled={creating}
            />
            {errors.summary && (
              <p className="text-sm text-destructive">{errors.summary.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Date *</Label>
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
                disabled={creating}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Time *</Label>
              <Input
                id="startTime"
                type="time"
                {...register("startTime")}
                disabled={creating}
              />
              {errors.startTime && (
                <p className="text-sm text-destructive">{errors.startTime.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <select
              id="duration"
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              {...register("duration")}
              disabled={creating}
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meetingUrl">Meeting URL (optional)</Label>
            <Input
              id="meetingUrl"
              type="url"
              placeholder="https://zoom.us/j/..."
              {...register("meetingUrl")}
              disabled={creating}
            />
            {errors.meetingUrl && (
              <p className="text-sm text-destructive">{errors.meetingUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Notes (optional)</Label>
            <Textarea
              id="description"
              placeholder="Meeting context, agenda, or notes..."
              rows={3}
              {...register("description")}
              disabled={creating}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Add Meeting"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
