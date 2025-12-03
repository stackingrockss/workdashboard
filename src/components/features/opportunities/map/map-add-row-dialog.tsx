"use client";

/**
 * MAPAddRowDialog Component
 *
 * Dialog for adding a new action item to the MAP.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type {
  MAPActionItem,
  MAPActionItemStatus,
} from "@/types/mutual-action-plan";
import { MAP_STATUS_LABELS } from "@/types/mutual-action-plan";

// ============================================================================
// Types
// ============================================================================

interface MAPAddRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: Omit<MAPActionItem, "id" | "order">) => void;
}

// ============================================================================
// Component
// ============================================================================

export function MAPAddRowDialog({
  open,
  onOpenChange,
  onAdd,
}: MAPAddRowDialogProps) {
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState<Date>();
  const [status, setStatus] = useState<MAPActionItemStatus>("not_started");
  const [owner, setOwner] = useState("");
  const [notes, setNotes] = useState("");
  const [isWeeklySync, setIsWeeklySync] = useState(false);

  // Reset form
  const resetForm = () => {
    setDescription("");
    setTargetDate(undefined);
    setStatus("not_started");
    setOwner("");
    setNotes("");
    setIsWeeklySync(false);
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim() || !owner.trim()) {
      return;
    }

    onAdd({
      description: description.trim(),
      targetDate: targetDate ? format(targetDate, "yyyy-MM-dd") : undefined,
      status,
      owner: owner.trim(),
      notes: notes.trim() || undefined,
      isWeeklySync,
    });

    resetForm();
    onOpenChange(false);
  };

  // Handle cancel
  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Action Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Schedule technical review meeting"
              required
            />
          </div>

          {/* Target Date */}
          <div className="space-y-2">
            <Label>Target Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !targetDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetDate ? format(targetDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as MAPActionItemStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(MAP_STATUS_LABELS) as [
                    MAPActionItemStatus,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Owner */}
          <div className="space-y-2">
            <Label htmlFor="owner">Owner *</Label>
            <Input
              id="owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g., Customer, Both, or specific name"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context or agenda items..."
              rows={2}
            />
          </div>

          {/* Weekly Sync */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isWeeklySync"
              checked={isWeeklySync}
              onCheckedChange={(checked) => setIsWeeklySync(checked === true)}
            />
            <Label htmlFor="isWeeklySync" className="font-normal">
              This is a weekly sync meeting (styled bold)
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!description.trim() || !owner.trim()}>
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
