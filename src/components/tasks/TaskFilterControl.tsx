"use client";

import { cn } from "@/lib/utils";
import type { TaskFilterPreference } from "@/lib/utils/task-filtering";

interface TaskFilterControlProps {
  currentFilter: TaskFilterPreference;
  onFilterChange: (filter: TaskFilterPreference) => void;
  disabled?: boolean;
}

const filterOptions: { value: TaskFilterPreference; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "thisWeekOrNoDueDate", label: "This Week" },
  { value: "noDueDate", label: "No Date" },
  { value: "all", label: "All" },
];

export function TaskFilterControl({
  currentFilter,
  onFilterChange,
  disabled = false,
}: TaskFilterControlProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filterOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onFilterChange(option.value)}
          disabled={disabled}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-full border transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            currentFilter === option.value
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-foreground border-border hover:bg-muted"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
