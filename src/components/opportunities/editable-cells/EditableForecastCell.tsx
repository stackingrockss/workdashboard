"use client";

import { useState } from "react";
import { EditableCell } from "../EditableCell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { type ForecastCategory } from "@/types/opportunity";

const FORECAST_CATEGORIES: { value: ForecastCategory; label: string }[] = [
  { value: "pipeline", label: "Pipeline" },
  { value: "bestCase", label: "Best Case" },
  { value: "commit", label: "Commit" },
];

interface EditableForecastCellProps {
  value: ForecastCategory | null;
  onSave: (value: ForecastCategory | null) => Promise<void>;
  className?: string;
}

export function EditableForecastCell({
  value,
  onSave,
  className,
}: EditableForecastCellProps) {
  const [open, setOpen] = useState(false);

  const formatForecastLabel = (forecast: ForecastCategory | null | undefined) => {
    if (!forecast) return null;
    return FORECAST_CATEGORIES.find((f) => f.value === forecast)?.label || forecast;
  };

  const handleSave = async (newValue: string) => {
    const valueToSave = newValue === "none" ? null : (newValue as ForecastCategory);
    await onSave(valueToSave);
    setOpen(false);
  };

  return (
    <EditableCell<ForecastCategory | null>
      value={value}
      onSave={onSave}
      className={className}
      autoSave={false}
      renderDisplay={(val) =>
        val ? (
          <Badge variant="secondary" className="capitalize">
            {formatForecastLabel(val)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      }
      renderEdit={({ value: editValue }) => (
        <Select
          value={editValue || "none"}
          onValueChange={handleSave}
          open={open}
          onOpenChange={setOpen}
        >
          <SelectTrigger className="h-8" onClick={(e) => e.stopPropagation()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {FORECAST_CATEGORIES.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
