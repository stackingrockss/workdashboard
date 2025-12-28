"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CreateFollowUpTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  companyName: string;
  onSuccess?: () => void;
}

export function CreateFollowUpTaskDialog({
  open,
  onOpenChange,
  opportunityId,
  companyName,
  onSuccess,
}: CreateFollowUpTaskDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    addDays(new Date(), 7) // Default to 1 week from now
  );
  const [taskTitle, setTaskTitle] = useState(`Follow up with ${companyName}`);

  const handleSubmit = async () => {
    if (!selectedDate) {
      toast.error("Please select a follow-up date");
      return;
    }

    setIsSubmitting(true);

    try {
      // Set due date to 9 AM on selected day
      const dueDate = new Date(selectedDate);
      dueDate.setHours(9, 0, 0, 0);

      const response = await fetch(`/api/v1/opportunities/${opportunityId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle,
          due: dueDate.toISOString(),
          notes: `Follow up with ${companyName}.\n\nThis is a manual follow-up reminder since no meeting is currently scheduled.`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || "Failed to create task");
      }

      toast.success("Follow-up task created", {
        description: `Task scheduled for ${format(selectedDate, "MMM d, yyyy")}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create follow-up task:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create follow-up task"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick date presets
  const presets = [
    { label: "Tomorrow", days: 1 },
    { label: "In 3 days", days: 3 },
    { label: "In 1 week", days: 7 },
    { label: "In 2 weeks", days: 14 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Follow-up Task</DialogTitle>
          <DialogDescription>
            Set a reminder to follow up with {companyName} when no meeting is scheduled.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Follow up with..."
            />
          </div>

          <div className="grid gap-2">
            <Label>Follow-up Date</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {presets.map((preset) => (
                <Button
                  key={preset.days}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(addDays(new Date(), preset.days))}
                  className={cn(
                    "text-xs",
                    selectedDate &&
                      format(selectedDate, "yyyy-MM-dd") ===
                        format(addDays(new Date(), preset.days), "yyyy-MM-dd") &&
                      "bg-primary text-primary-foreground"
                  )}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedDate}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
