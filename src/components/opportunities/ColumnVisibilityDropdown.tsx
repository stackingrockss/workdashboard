"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Columns3 } from "lucide-react";
import type { VisibilityState } from "@tanstack/react-table";

// Legacy type for backward compatibility
export interface ColumnVisibility {
  account: boolean;
  owner: boolean;
  stage: boolean;
  forecastCategory: boolean;
  amountArr: boolean;
  confidenceLevel: boolean;
  closeDate: boolean;
  daysLeft: boolean;
  nextStep: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
  account: true,
  owner: true,
  stage: true,
  forecastCategory: true,
  amountArr: true,
  confidenceLevel: true,
  closeDate: true,
  daysLeft: true,
  nextStep: true,
};

interface ColumnVisibilityDropdownProps {
  columns: string[];
  columnConfigs: Record<string, { label: string }>;
  visibility: VisibilityState;
  onVisibilityChange: (visibility: VisibilityState) => void;
}

export function ColumnVisibilityDropdown({
  columns,
  columnConfigs,
  visibility,
  onVisibilityChange,
}: ColumnVisibilityDropdownProps) {
  const handleToggle = (column: string) => {
    onVisibilityChange({
      ...visibility,
      [column]: visibility[column] === false ? true : false,
    });
  };

  const visibleCount = columns.filter(col => visibility[col] !== false).length;
  const totalCount = columns.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="h-4 w-4 mr-2" />
          Columns ({visibleCount}/{totalCount})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((colId) => (
          <DropdownMenuCheckboxItem
            key={colId}
            checked={visibility[colId] !== false}
            onCheckedChange={() => handleToggle(colId)}
          >
            {columnConfigs[colId]?.label || colId}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
