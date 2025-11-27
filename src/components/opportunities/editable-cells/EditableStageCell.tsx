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
import { type OpportunityStage } from "@/types/opportunity";
import { STAGE_OPTIONS } from "@/lib/constants";

interface EditableStageCellProps {
  value: OpportunityStage;
  onSave: (value: OpportunityStage) => Promise<void>;
  className?: string;
}

export function EditableStageCell({ value, onSave, className }: EditableStageCellProps) {
  const formatStageLabel = (stage: OpportunityStage) => {
    return STAGE_OPTIONS.find((s) => s.value === stage)?.label || stage;
  };

  return (
    <EditableCell
      value={value}
      onSave={onSave}
      className={className}
      renderDisplay={(val) => (
        <Badge variant="outline" className="capitalize">
          {formatStageLabel(val)}
        </Badge>
      )}
      renderEdit={({ value: editValue, onChange }) => (
        <Select value={editValue} onValueChange={onChange}>
          <SelectTrigger className="h-8">
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
