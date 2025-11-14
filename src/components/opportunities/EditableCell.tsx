"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";

interface EditableCellProps<T = unknown> {
  value: T;
  onSave: (value: T) => Promise<void>;
  onCancel?: () => void;
  renderEdit: (props: {
    value: T;
    onChange: (value: T) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  }) => React.ReactNode;
  renderDisplay?: (value: T) => React.ReactNode;
  className?: string;
  editClassName?: string;
  autoSave?: boolean; // Auto-save on blur
  showActions?: boolean; // Show save/cancel buttons
}

export function EditableCell<T = unknown>({
  value,
  onSave,
  onCancel,
  renderEdit,
  renderDisplay,
  className,
  editClassName,
  autoSave = true,
  showActions = false,
}: EditableCellProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset edit value when prop value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = async () => {
    // Don't save if value hasn't changed
    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      // Revert to original value on error
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
    setError(null);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleBlur = () => {
    // Don't auto-save if user clicks save/cancel buttons
    if (showActions) return;

    if (autoSave && !isSaving) {
      handleSave();
    }
  };

  const handleClick = () => {
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative group", className)}
      onClick={handleClick}
    >
      {!isEditing ? (
        <div className="cursor-pointer min-h-[2rem] flex items-center group-hover:bg-muted/50 rounded px-2 -mx-2 transition-colors">
          {renderDisplay ? renderDisplay(value) : (value as React.ReactNode)}
        </div>
      ) : (
        <div className={cn("relative", editClassName)} onBlur={handleBlur}>
          <div className="flex items-center gap-1">
            <div className="flex-1">
              {renderEdit({
                value: editValue,
                onChange: setEditValue,
                onKeyDown: handleKeyDown,
              })}
            </div>
            {showActions && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded text-green-600 dark:text-green-500 disabled:opacity-50"
                  aria-label="Save"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-500 disabled:opacity-50"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {error && (
            <div className="absolute top-full left-0 mt-1 text-xs text-red-600 dark:text-red-500 bg-background border border-red-200 dark:border-red-800 rounded px-2 py-1 shadow-sm z-10">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
