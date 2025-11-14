"use client";

import { EditableCell } from "../EditableCell";
import { Textarea } from "@/components/ui/textarea";

interface EditableTextCellProps {
  value: string | null | undefined;
  onSave: (value: string | null) => Promise<void>;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}

export function EditableTextCell({
  value,
  onSave,
  className,
  placeholder = "Enter text...",
  multiline = false,
}: EditableTextCellProps) {
  return (
    <EditableCell
      value={value || ""}
      onSave={async (newValue: string) => {
        await onSave(newValue.trim() || null);
      }}
      className={className}
      renderDisplay={(val) => (
        <span className={multiline ? "line-clamp-2" : "truncate block"}>
          {val || <span className="text-muted-foreground">-</span>}
        </span>
      )}
      renderEdit={({ value: editValue, onChange, onKeyDown }) =>
        multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              // Only handle Escape for textarea, let Enter create new lines
              if (e.key === "Escape") {
                onKeyDown(e);
              }
            }}
            className="min-h-[80px] resize-none"
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full h-8 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            placeholder={placeholder}
            autoFocus
          />
        )
      }
    />
  );
}
