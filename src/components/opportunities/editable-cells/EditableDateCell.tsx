"use client";

import { useState } from "react";
import { EditableCell } from "../EditableCell";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { formatDateShort } from "@/lib/format";

interface EditableDateCellProps {
  value: string | null | undefined;
  onSave: (value: string | null) => Promise<void>;
  className?: string;
  label?: string;
}

export function EditableDateCell({
  value,
  onSave,
  className,
  label = "Pick a date",
}: EditableDateCellProps) {
  const [open, setOpen] = useState(false);

  const handleSave = async (newValue: Date | undefined) => {
    if (!newValue) {
      await onSave(null);
    } else {
      await onSave(newValue.toISOString());
    }
    setOpen(false);
  };

  return (
    <EditableCell<string | null | undefined>
      value={value}
      onSave={async (v) => {
        // This won't be called directly as we handle save in the popover
        await onSave(v ?? null);
      }}
      className={className}
      autoSave={false}
      renderDisplay={(val) => (
        <span>{val ? formatDateShort(val) : "-"}</span>
      )}
      renderEdit={({ value: editValue }) => (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-8 w-full justify-start text-left font-normal",
                !editValue && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {editValue ? format(new Date(editValue), "PPP") : label}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={editValue ? new Date(editValue) : undefined}
              onSelect={handleSave}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    />
  );
}
