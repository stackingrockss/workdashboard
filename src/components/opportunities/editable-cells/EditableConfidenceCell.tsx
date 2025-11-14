"use client";

import { EditableCell } from "../EditableCell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface EditableConfidenceCellProps {
  value: number;
  onSave: (value: number) => Promise<void>;
  className?: string;
}

export function EditableConfidenceCell({
  value,
  onSave,
  className,
}: EditableConfidenceCellProps) {
  const handleSave = async (newValue: string) => {
    const numValue = parseInt(newValue, 10);

    // Validate 1-5 range
    if (isNaN(numValue) || numValue < 1 || numValue > 5) {
      throw new Error("Confidence must be between 1 and 5");
    }

    await onSave(numValue);
  };

  return (
    <EditableCell
      value={value.toString()}
      onSave={handleSave}
      className={className}
      renderDisplay={(val) => (
        <Badge variant={parseInt(val) >= 4 ? "default" : "secondary"}>
          {val}
        </Badge>
      )}
      renderEdit={({ value: editValue, onChange, onKeyDown }) => (
        <Input
          type="number"
          min={1}
          max={5}
          value={editValue}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-8 w-16"
          autoFocus
        />
      )}
    />
  );
}
