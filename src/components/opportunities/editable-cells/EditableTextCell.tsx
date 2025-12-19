"use client";

import { EditableCell } from "../EditableCell";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditableTextCellProps {
  value: string | null | undefined;
  onSave: (value: string | null) => Promise<void>;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  /** Maximum width for truncation (default: 200px) */
  maxWidth?: number;
  /** Character threshold to show tooltip (default: 30) */
  tooltipThreshold?: number;
}

export function EditableTextCell({
  value,
  onSave,
  className,
  placeholder = "Enter text...",
  multiline = false,
  maxWidth = 200,
  tooltipThreshold = 30,
}: EditableTextCellProps) {
  const displayValue = value || "";
  const shouldShowTooltip = displayValue.length > tooltipThreshold;

  const renderDisplayContent = (val: string) => {
    const content = (
      <span
        className={multiline ? "line-clamp-2" : "truncate block"}
        style={{ maxWidth: `${maxWidth}px` }}
      >
        {val || <span className="text-muted-foreground">-</span>}
      </span>
    );

    if (shouldShowTooltip && val) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-[300px] whitespace-pre-wrap text-sm"
          >
            {val}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <EditableCell
      value={displayValue}
      onSave={async (newValue: string) => {
        await onSave(newValue.trim() || null);
      }}
      className={className}
      renderDisplay={renderDisplayContent}
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
