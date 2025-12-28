"use client";

// Editable version of InsightsDisplay for per-call insight editing
// Allows users to add, edit, and delete pain points, goals, and next steps

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Target,
  ListChecks,
  Plus,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EditableInsightsDisplayProps {
  transcriptId: string;
  transcriptType: "gong" | "granola";
  opportunityId: string;
  painPoints: string[];
  goals: string[];
  nextSteps: string[];
  onUpdate?: () => void;
}

interface EditableInsightSectionProps {
  title: string;
  items: string[];
  icon: React.ReactNode;
  colorClass: string;
  fieldName: "painPoints" | "goals" | "nextSteps";
  onSave: (newItems: string[]) => Promise<void>;
  singularName: string;
}

function EditableInsightSection({
  title,
  items,
  icon,
  colorClass,
  onSave,
  singularName,
}: EditableInsightSectionProps) {
  const [localItems, setLocalItems] = useState<string[]>(items);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [isAddingSaving, setIsAddingSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // Sync with prop changes
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingIndex !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingIndex]);

  // Focus input when adding
  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(localItems[index]);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  // Define handleDelete first since handleSaveEdit references it
  const handleDelete = useCallback(async (index: number) => {
    setSavingIndex(index);
    const newItems = localItems.filter((_, i) => i !== index);

    try {
      await onSave(newItems);
      setLocalItems(newItems);
      if (editingIndex === index) {
        handleCancelEdit();
      }
      toast.success(`${singularName} removed`);
    } catch {
      toast.error(`Failed to remove ${singularName}`);
    } finally {
      setSavingIndex(null);
    }
  }, [localItems, onSave, singularName, editingIndex]);

  const handleSaveEdit = useCallback(async () => {
    if (editingIndex === null) return;

    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      // If empty, treat as delete
      handleDelete(editingIndex);
      return;
    }

    if (trimmedValue === localItems[editingIndex]) {
      // No change
      handleCancelEdit();
      return;
    }

    setSavingIndex(editingIndex);
    const newItems = [...localItems];
    newItems[editingIndex] = trimmedValue;

    try {
      await onSave(newItems);
      setLocalItems(newItems);
      handleCancelEdit();
    } catch {
      toast.error(`Failed to update ${singularName}`);
    } finally {
      setSavingIndex(null);
    }
  }, [editingIndex, editValue, localItems, onSave, singularName, handleDelete]);

  const handleCancelAdd = () => {
    setIsAdding(false);
    setAddValue("");
  };

  const handleSaveAdd = useCallback(async () => {
    const trimmedValue = addValue.trim();
    if (!trimmedValue) {
      handleCancelAdd();
      return;
    }

    setIsAddingSaving(true);
    const newItems = [...localItems, trimmedValue];

    try {
      await onSave(newItems);
      setLocalItems(newItems);
      handleCancelAdd();
      toast.success(`${singularName} added`);
    } catch {
      toast.error(`Failed to add ${singularName}`);
    } finally {
      setIsAddingSaving(false);
    }
  }, [addValue, localItems, onSave, singularName]);

  const handleKeyDown = (
    e: React.KeyboardEvent,
    action: "edit" | "add"
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (action === "edit") {
        handleSaveEdit();
      } else {
        handleSaveAdd();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (action === "edit") {
        handleCancelEdit();
      } else {
        handleCancelAdd();
      }
    }
  };

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={cn("flex items-center gap-2 font-medium text-xs", colorClass)}>
          {icon}
          {title}
        </div>
      </div>

      {/* Items list */}
      <ul className="list-none space-y-1 ml-1">
        {localItems.map((item, idx) => (
          <li key={idx} className="group relative">
            {editingIndex === idx ? (
              // Edit mode
              <div className="flex items-center gap-1">
                <Input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, "edit")}
                  onBlur={handleSaveEdit}
                  className="h-7 text-xs"
                  disabled={savingIndex === idx}
                />
                {savingIndex === idx && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            ) : (
              // Display mode
              <div className="flex items-start gap-1">
                <span className="text-muted-foreground text-xs">•</span>
                <span
                  onClick={() => handleStartEdit(idx)}
                  className={cn(
                    "text-xs text-muted-foreground flex-1 cursor-pointer hover:text-foreground transition-colors",
                    "hover:bg-muted/50 rounded px-1 -mx-1",
                    savingIndex === idx && "opacity-50"
                  )}
                >
                  {item}
                </span>
                {/* Delete button - visible on hover */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(idx);
                  }}
                  disabled={savingIndex === idx}
                >
                  {savingIndex === idx ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  )}
                  <span className="sr-only">Delete {singularName}</span>
                </Button>
              </div>
            )}
          </li>
        ))}

        {/* Add new item */}
        {isAdding ? (
          <li className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs">•</span>
            <Input
              ref={addInputRef}
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "add")}
              onBlur={() => {
                if (!addValue.trim()) {
                  handleCancelAdd();
                } else {
                  handleSaveAdd();
                }
              }}
              placeholder={`New ${singularName.toLowerCase()}...`}
              className="h-7 text-xs flex-1"
              disabled={isAddingSaving}
            />
            {isAddingSaving ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={handleSaveAdd}
              >
                <Check className="h-3 w-3 text-green-600" />
              </Button>
            )}
          </li>
        ) : (
          <li>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground hover:text-foreground px-1 -ml-1"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add {singularName.toLowerCase()}
            </Button>
          </li>
        )}
      </ul>
    </div>
  );
}

export function EditableInsightsDisplay({
  transcriptId,
  transcriptType,
  opportunityId,
  painPoints,
  goals,
  nextSteps,
  onUpdate,
}: EditableInsightsDisplayProps) {
  const saveInsights = useCallback(
    async (field: "painPoints" | "goals" | "nextSteps", newValues: string[]) => {
      const endpoint =
        transcriptType === "gong"
          ? `/api/v1/opportunities/${opportunityId}/gong-calls/${transcriptId}`
          : `/api/v1/opportunities/${opportunityId}/granola-notes/${transcriptId}`;

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValues }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      onUpdate?.();
    },
    [transcriptId, transcriptType, opportunityId, onUpdate]
  );

  const hasAnyInsights =
    painPoints.length > 0 || goals.length > 0 || nextSteps.length > 0;

  // Always show sections for adding even if empty
  return (
    <div className="space-y-2">
      <EditableInsightSection
        title="Pain Points"
        items={painPoints}
        icon={<AlertTriangle className="h-3 w-3" />}
        colorClass="text-orange-600 dark:text-orange-400"
        fieldName="painPoints"
        onSave={(newItems) => saveInsights("painPoints", newItems)}
        singularName="Pain point"
      />

      <EditableInsightSection
        title="Goals"
        items={goals}
        icon={<Target className="h-3 w-3" />}
        colorClass="text-blue-600 dark:text-blue-400"
        fieldName="goals"
        onSave={(newItems) => saveInsights("goals", newItems)}
        singularName="Goal"
      />

      <EditableInsightSection
        title="Next Steps"
        items={nextSteps}
        icon={<ListChecks className="h-3 w-3" />}
        colorClass="text-green-600 dark:text-green-400"
        fieldName="nextSteps"
        onSave={(newItems) => saveInsights("nextSteps", newItems)}
        singularName="Next step"
      />

      {!hasAnyInsights && (
        <p className="text-xs text-muted-foreground italic pt-1">
          Click &quot;Add&quot; to add insights manually, or parse a transcript to extract them automatically.
        </p>
      )}
    </div>
  );
}
