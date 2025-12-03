"use client";

/**
 * MAPTableRow Component
 *
 * Single editable row in the MAP table.
 * Supports inline editing for all fields.
 */

import { useState, useRef, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Trash2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, isBefore, startOfDay } from "date-fns";
import type {
  MAPActionItem,
  MAPActionItemStatus,
} from "@/types/mutual-action-plan";
import { MAP_STATUS_LABELS } from "@/types/mutual-action-plan";

// ============================================================================
// Types
// ============================================================================

interface MAPTableRowProps {
  item: MAPActionItem;
  onUpdate: (updates: Partial<MAPActionItem>) => void;
  onDelete: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function MAPTableRow({ item, onUpdate, onDelete }: MAPTableRowProps) {
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Check if overdue
  const isOverdue =
    item.targetDate &&
    item.status !== "completed" &&
    isBefore(parseISO(item.targetDate), startOfDay(new Date()));

  // Start editing a field
  const startEditing = (field: string, currentValue: string) => {
    setIsEditing(field);
    setEditValue(currentValue);
  };

  // Save edited value
  const saveEdit = () => {
    if (!isEditing) return;

    const updates: Partial<MAPActionItem> = {};
    if (isEditing === "description" && editValue.trim()) {
      updates.description = editValue.trim();
    } else if (isEditing === "owner" && editValue.trim()) {
      updates.owner = editValue.trim();
    } else if (isEditing === "notes") {
      updates.notes = editValue.trim() || undefined;
    }

    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
    setIsEditing(null);
  };

  // Cancel editing
  const cancelEdit = () => {
    setIsEditing(null);
    setEditValue("");
  };

  // Handle status change
  const handleStatusChange = (status: MAPActionItemStatus) => {
    onUpdate({ status });
  };

  // Handle date change
  const handleDateChange = (
    field: "targetDate" | "completionDate",
    date: Date | undefined
  ) => {
    onUpdate({
      [field]: date ? format(date, "yyyy-MM-dd") : undefined,
    });
  };

  // Parse date safely (handles null from Prisma JSON)
  const parseDate = (dateStr?: string | null): Date | undefined => {
    if (!dateStr) return undefined;
    const date = parseISO(dateStr);
    return isValid(date) ? date : undefined;
  };

  // Get status badge variant
  const getStatusVariant = (
    status: MAPActionItemStatus
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "delayed":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <TableRow
      className={cn(
        item.isWeeklySync && "font-semibold bg-muted/30",
        isOverdue && "bg-red-50 dark:bg-red-950/20"
      )}
    >
      {/* Target Date */}
      <TableCell>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start text-left font-normal h-8 px-2",
                !item.targetDate && "text-muted-foreground",
                isOverdue && "text-red-600 dark:text-red-400"
              )}
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {item.targetDate
                ? format(parseISO(item.targetDate), "MMM d, yyyy")
                : "Set date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parseDate(item.targetDate)}
              onSelect={(date) => handleDateChange("targetDate", date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </TableCell>

      {/* Description */}
      <TableCell>
        {isEditing === "description" ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            className="h-8"
          />
        ) : (
          <div
            className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
            onClick={() => startEditing("description", item.description)}
          >
            {item.description}
          </div>
        )}
      </TableCell>

      {/* Status */}
      <TableCell>
        <Select value={item.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue>
              <Badge variant={getStatusVariant(item.status)} className="text-xs">
                {MAP_STATUS_LABELS[item.status]}
              </Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(
              Object.entries(MAP_STATUS_LABELS) as [
                MAPActionItemStatus,
                string,
              ][]
            ).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                <Badge variant={getStatusVariant(value)} className="text-xs">
                  {label}
                </Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Completion Date */}
      <TableCell>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start text-left font-normal h-8 px-2",
                !item.completionDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {item.completionDate
                ? format(parseISO(item.completionDate), "MMM d, yyyy")
                : "—"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parseDate(item.completionDate)}
              onSelect={(date) => handleDateChange("completionDate", date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </TableCell>

      {/* Owner */}
      <TableCell>
        {isEditing === "owner" ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            className="h-8"
          />
        ) : (
          <div
            className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
            onClick={() => startEditing("owner", item.owner)}
          >
            {item.owner}
          </div>
        )}
      </TableCell>

      {/* Notes */}
      <TableCell>
        {isEditing === "notes" ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            className="h-8"
          />
        ) : (
          <div
            className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 text-muted-foreground"
            onClick={() => startEditing("notes", item.notes || "")}
          >
            {item.notes || "—"}
          </div>
        )}
      </TableCell>

      {/* Delete */}
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
