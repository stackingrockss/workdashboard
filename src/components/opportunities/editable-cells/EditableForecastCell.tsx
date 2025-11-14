"use client";

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
  const formatForecastLabel = (forecast: ForecastCategory | null | undefined) => {
    if (!forecast) return null;
    return FORECAST_CATEGORIES.find((f) => f.value === forecast)?.label || forecast;
  };

  return (
    <EditableCell<ForecastCategory | null>
      value={value}
      onSave={onSave}
      className={className}
      renderDisplay={(val) =>
        val ? (
          <Badge variant="secondary" className="capitalize">
            {formatForecastLabel(val)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      }
      renderEdit={({ value: editValue, onChange }) => (
        <Select
          value={editValue || "none"}
          onValueChange={(v) => onChange(v === "none" ? null : v as ForecastCategory)}
        >
          <SelectTrigger className="h-8">
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
