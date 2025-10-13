"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BaseEditableFieldProps {
  value: string | number | null | undefined;
  onSave: (value: string | number | null) => Promise<void>;
  label: string;
  placeholder?: string;
  className?: string;
  displayFormatter?: (value: string | number | null | undefined) => string;
}

interface InlineTextInputProps extends BaseEditableFieldProps {
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
}

export function InlineTextInput({
  value,
  onSave,
  label,
  placeholder = "Click to edit",
  className,
  displayFormatter,
  type = "text",
  min,
  max,
  step,
}: InlineTextInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === (value?.toString() || "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const valueToSave =
        type === "number" && editValue
          ? parseFloat(editValue)
          : editValue || null;
      await onSave(valueToSave);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const displayValue = displayFormatter
    ? displayFormatter(value)
    : value?.toString() || placeholder;

  if (!isEditing) {
    return (
      <div
        className={cn(
          "rounded-lg border p-4 cursor-pointer transition-colors group",
          isHovered && "border-primary/50 bg-accent/50",
          className
        )}
        onClick={() => setIsEditing(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{label}</div>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div
          className={cn(
            "font-medium",
            !value && "text-muted-foreground italic"
          )}
        >
          {displayValue}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-4 border-primary", className)}>
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="h-8"
        />
        {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}

interface InlineTextareaProps extends BaseEditableFieldProps {
  rows?: number;
}

export function InlineTextarea({
  value,
  onSave,
  label,
  placeholder = "Click to edit",
  className,
  displayFormatter,
  rows = 3,
}: InlineTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === (value?.toString() || "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue || null);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    // Ctrl/Cmd + Enter to save
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const displayValue = displayFormatter
    ? displayFormatter(value)
    : value?.toString() || placeholder;

  if (!isEditing) {
    return (
      <div
        className={cn(
          "rounded-lg border p-4 cursor-pointer transition-colors group",
          isHovered && "border-primary/50 bg-accent/50",
          className
        )}
        onClick={() => setIsEditing(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{label}</div>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div
          className={cn(
            "font-medium whitespace-pre-wrap",
            !value && "text-muted-foreground italic"
          )}
        >
          {displayValue}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-4 border-primary", className)}>
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <Textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        placeholder={placeholder}
        rows={rows}
        className="resize-none"
      />
      <div className="flex items-center justify-end gap-2 mt-2">
        <span className="text-xs text-muted-foreground mr-auto">
          Ctrl+Enter to save, Esc to cancel
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

interface InlineSelectProps extends BaseEditableFieldProps {
  options: { value: string; label: string }[];
}

export function InlineSelect({
  value,
  onSave,
  label,
  placeholder = "Select...",
  className,
  displayFormatter,
  options,
}: InlineSelectProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleSave = async (newValue: string) => {
    if (newValue === (value?.toString() || "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue || null);
      setEditValue(newValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || "");
    setIsEditing(false);
  };

  const displayValue = displayFormatter
    ? displayFormatter(value)
    : options.find((opt) => opt.value === value)?.label || placeholder;

  if (!isEditing) {
    return (
      <div
        className={cn(
          "rounded-lg border p-4 cursor-pointer transition-colors group",
          isHovered && "border-primary/50 bg-accent/50",
          className
        )}
        onClick={() => setIsEditing(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{label}</div>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div
          className={cn(
            "font-medium",
            !value && "text-muted-foreground italic"
          )}
        >
          {displayValue}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-4 border-primary", className)}>
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <Select
          value={editValue}
          onValueChange={handleSave}
          disabled={isSaving}
          defaultOpen
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSaving && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="flex items-center justify-end gap-2 mt-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface InlineDatePickerProps extends BaseEditableFieldProps {
  value: string | null | undefined;
  onSave: (value: string | null) => Promise<void>;
}

export function InlineDatePicker({
  value,
  onSave,
  label,
  placeholder = "Click to set date",
  className,
  displayFormatter,
}: InlineDatePickerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(
    value ? new Date(value).toISOString().split("T")[0] : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const currentDateValue = value
      ? new Date(value).toISOString().split("T")[0]
      : "";

    if (editValue === currentDateValue) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const valueToSave = editValue
        ? new Date(editValue).toISOString()
        : null;
      await onSave(valueToSave);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value ? new Date(value).toISOString().split("T")[0] : "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const displayValue = displayFormatter
    ? displayFormatter(value)
    : value
    ? new Date(value).toLocaleDateString()
    : placeholder;

  if (!isEditing) {
    return (
      <div
        className={cn(
          "rounded-lg border p-4 cursor-pointer transition-colors group",
          isHovered && "border-primary/50 bg-accent/50",
          className
        )}
        onClick={() => setIsEditing(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{label}</div>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div
          className={cn(
            "font-medium",
            !value && "text-muted-foreground italic"
          )}
        >
          {displayValue}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-4 border-primary", className)}>
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          type="date"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          className="h-8"
        />
        {isSaving && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
