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
  value?: string; // ISO date string (YYYY-MM-DD)
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

/**
 * Format a date input string with slashes as user types
 * Supports partial input (e.g., "12" → "12", "1231" → "12/31", "12312024" → "12/31/2024")
 */
function formatDateInput(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");

  // Add slashes as user types
  if (digits.length <= 2) {
    return digits;
  } else if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  } else {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }
}

/**
 * Try to parse a date string in US format (MM/dd/yyyy) to ISO format (yyyy-MM-dd)
 * Returns empty string if invalid
 */
function parseUSDate(value: string): string {
  if (!value) return "";

  // Remove all non-digits for length check
  const digits = value.replace(/\D/g, "");

  // Only parse if we have a complete date (8 digits)
  if (digits.length === 8) {
    try {
      const parsed = parse(value, "MM/dd/yyyy", new Date());
      if (isValid(parsed)) {
        return format(parsed, "yyyy-MM-dd");
      }
    } catch {
      // Invalid date
    }
  }

  // Return empty string for partial or invalid dates (don't break the input)
  return "";
}

export function DatePicker({
  value,
  onChange,
  placeholder = "MM/DD/YYYY",
  disabled,
  required,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Parse the ISO value to a Date object
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const date = new Date(value);
      return isValid(date) ? date : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  // Update input value when selectedDate changes (convert ISO to US format)
  React.useEffect(() => {
    if (selectedDate) {
      setInputValue(format(selectedDate, "MM/dd/yyyy"));
    } else {
      setInputValue("");
    }
  }, [selectedDate]);

  // Handle manual text input with auto-formatting
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    // Get the previous length to calculate cursor adjustment
    const prevLength = inputValue.length;

    // Format the input
    const formatted = formatDateInput(newValue);
    setInputValue(formatted);

    // Calculate new cursor position (adjust for auto-inserted slashes)
    const lengthDiff = formatted.length - prevLength;
    const newCursorPosition = cursorPosition + lengthDiff;

    // Restore cursor position after React updates the input
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    });

    // Try to parse the formatted date to ISO format
    const isoDate = parseUSDate(formatted);
    if (isoDate) {
      // Valid complete date - update the parent with ISO format
      onChange(isoDate);
    } else if (!formatted) {
      // Empty input
      onChange("");
    }
    // For partial dates, don't update onChange - let user finish typing
  };

  // Handle blur to validate the final input
  const handleBlur = () => {
    const isoDate = parseUSDate(inputValue);
    if (isoDate) {
      onChange(isoDate);
    } else if (inputValue && inputValue.replace(/\D/g, "").length > 0) {
      // Invalid date was entered - clear it
      setInputValue("");
      onChange("");
    }
  };

  // Handle calendar selection
  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const isoFormatted = format(date, "yyyy-MM-dd");
      const usFormatted = format(date, "MM/dd/yyyy");
      onChange(isoFormatted);
      setInputValue(usFormatted);
    } else {
      onChange("");
      setInputValue("");
    }
    setOpen(false);
  };

  return (
    <div className="flex gap-2">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="flex-1"
        maxLength={10}
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
