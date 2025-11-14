"use client";

import { EditableCell } from "../EditableCell";
import { Input } from "@/components/ui/input";
import { formatCurrencyCompact, parseCurrencyInput, formatCurrencyInput } from "@/lib/format";

interface EditableArrCellProps {
  value: number;
  onSave: (value: number) => Promise<void>;
  className?: string;
}

export function EditableArrCell({ value, onSave, className }: EditableArrCellProps) {
  const handleSave = async (newValue: number) => {
    // Validate non-negative
    if (isNaN(newValue) || newValue < 0) {
      throw new Error("ARR must be a non-negative number");
    }

    await onSave(newValue);
  };

  return (
    <EditableCell<number>
      value={value}
      onSave={handleSave}
      className={className}
      renderDisplay={(val) => (
        <span className="font-medium">{formatCurrencyCompact(val)}</span>
      )}
      renderEdit={({ value: editValue, onChange, onKeyDown }) => (
        <Input
          type="text"
          value={formatCurrencyInput(editValue)}
          onChange={(e) => onChange(parseCurrencyInput(e.target.value))}
          onKeyDown={onKeyDown}
          className="h-8 text-right"
          autoFocus
          placeholder="0"
        />
      )}
    />
  );
}
