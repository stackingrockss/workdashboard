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
import { type OpportunityStage } from "@/types/opportunity";
import { STAGE_OPTIONS } from "@/lib/constants";

interface EditableStageCellProps {
  value: OpportunityStage;
  onSave: (value: OpportunityStage) => Promise<void>;
  className?: string;
}

export function EditableStageCell({ value, onSave, className }: EditableStageCellProps) {
  const [open, setOpen] = useState(false);

  const formatStageLabel = (stage: OpportunityStage) => {
    return STAGE_OPTIONS.find((s) => s.value === stage)?.label || stage;
  };

  const handleSave = async (newValue: OpportunityStage) => {
    await onSave(newValue);
    setOpen(false);
  };

  return (
    <EditableCell
      value={value}
      onSave={onSave}
      className={className}
      autoSave={false}
      renderDisplay={(val) => (
        <Badge variant="outline" className="capitalize">
          {formatStageLabel(val)}
        </Badge>
      )}
      renderEdit={({ value: editValue }) => (
        <Select
          value={editValue}
          onValueChange={handleSave}
          open={open}
          onOpenChange={setOpen}
        >
          <SelectTrigger className="h-8" onClick={(e) => e.stopPropagation()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGE_OPTIONS.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
