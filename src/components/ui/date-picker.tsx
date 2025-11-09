"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DatePickerProps {
  value?: string; // ISO date string or YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  required,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // Parse the value to a Date object
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const date = new Date(value);
      return isValid(date) ? date : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  // Update input value when selectedDate changes
  React.useEffect(() => {
    if (selectedDate) {
      setInputValue(format(selectedDate, "yyyy-MM-dd"));
    } else {
      setInputValue("");
    }
  }, [selectedDate]);

  // Handle manual text input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Try to parse common date formats
    if (!newValue) {
      onChange("");
      return;
    }

    // Try parsing as YYYY-MM-DD
    const formats = ["yyyy-MM-dd", "MM/dd/yyyy", "M/d/yyyy", "MM-dd-yyyy"];

    for (const formatString of formats) {
      try {
        const parsed = parse(newValue, formatString, new Date());
        if (isValid(parsed)) {
          onChange(format(parsed, "yyyy-MM-dd"));
          return;
        }
      } catch {
        // Try next format
      }
    }

    // If no format matched, store the raw value (partial input)
    onChange(newValue);
  };

  // Handle calendar selection
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, "yyyy-MM-dd");
      onChange(formatted);
      setInputValue(formatted);
    } else {
      onChange("");
      setInputValue("");
    }
    setOpen(false);
  };

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="flex-1"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-10 p-0",
              !selectedDate && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
