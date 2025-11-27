"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TaskFilterPreference } from "@/lib/utils/task-filtering";

interface TaskFilterControlProps {
  currentFilter: TaskFilterPreference;
  onFilterChange: (filter: TaskFilterPreference) => void;
  disabled?: boolean;
}

export function TaskFilterControl({
  currentFilter,
  onFilterChange,
  disabled = false,
}: TaskFilterControlProps) {
  return (
    <Tabs value={currentFilter} onValueChange={(value) => onFilterChange(value as TaskFilterPreference)}>
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="thisWeekOrNoDueDate" disabled={disabled}>
          This Week
        </TabsTrigger>
        <TabsTrigger value="thisWeek" disabled={disabled}>
          Week Only
        </TabsTrigger>
        <TabsTrigger value="overdue" disabled={disabled}>
          Overdue
        </TabsTrigger>
        <TabsTrigger value="all" disabled={disabled}>
          All
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
