"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Clock, X } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { toast } from "sonner";

interface InlineDueDateEditorProps {
  taskId: string;
  listId: string;
  currentDue: string | Date | null;
  onDueChange?: (newDue: string | null) => void;
  onError?: (error: string) => void;
  variant?: "destructive" | "default" | "secondary";
}

export function InlineDueDateEditor({
  taskId,
  listId,
  currentDue,
  onDueChange,
  onError,
  variant = "secondary",
}: InlineDueDateEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [optimisticDue, setOptimisticDue] = useState<string | null>(
    currentDue
      ? (typeof currentDue === "string" ? currentDue : currentDue.toISOString())
      : null
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleDateSelect = async (date: Date | undefined) => {
    const newDue = date ? date.toISOString() : null;

    // Store previous value for rollback
    const previousDue = optimisticDue;

    // Optimistic update
    setOptimisticDue(newDue);
    setIsOpen(false);

    // Notify parent immediately
    onDueChange?.(newDue);

    // Background save
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/v1/tasks/lists/${listId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ due: newDue }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update due date");
      }

      toast.success("Due date updated");
    } catch (error) {
      console.error("Failed to update due date:", error);

      // Rollback on error
      setOptimisticDue(previousDue);
      onDueChange?.(previousDue);

      const errorMsg = "Failed to update due date";
      toast.error(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearDate = async () => {
    await handleDateSelect(undefined);
  };

  const displayDate = optimisticDue
    ? formatDateShort(optimisticDue)
    : "No due date";

  const selectedDate = optimisticDue ? new Date(optimisticDue) : undefined;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Badge
          variant={variant}
          className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
        >
          <Clock className="h-3 w-3 mr-1" />
          {displayDate}
          {isSaving && " (saving...)"}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Set due date</h4>
            {optimisticDue && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearDate}
                className="h-auto p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Quick date options */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                handleDateSelect(today);
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                handleDateSelect(tomorrow);
              }}
            >
              Tomorrow
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                nextWeek.setHours(0, 0, 0, 0);
                handleDateSelect(nextWeek);
              }}
            >
              Next Week
            </Button>
          </div>

          {/* Calendar picker */}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
