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

const STAGES: { value: OpportunityStage; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "demo", label: "Demo" },
  { value: "validateSolution", label: "Validate Solution" },
  { value: "decisionMakerApproval", label: "Decision Maker Approval" },
  { value: "contracting", label: "Contracting" },
  { value: "closedWon", label: "Closed Won" },
  { value: "closedLost", label: "Closed Lost" },
];

interface EditableStageCellProps {
  value: OpportunityStage;
  onSave: (value: OpportunityStage) => Promise<void>;
  className?: string;
}

export function EditableStageCell({ value, onSave, className }: EditableStageCellProps) {
  const formatStageLabel = (stage: OpportunityStage) => {
    return STAGES.find((s) => s.value === stage)?.label || stage;
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
            {STAGES.map((stage) => (
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
