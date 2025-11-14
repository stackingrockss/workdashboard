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

interface ColumnVisibilityDropdownProps {
  visibility: ColumnVisibility;
  onVisibilityChange: (visibility: ColumnVisibility) => void;
}

export function ColumnVisibilityDropdown({
  visibility,
  onVisibilityChange,
}: ColumnVisibilityDropdownProps) {
  const handleToggle = (column: keyof ColumnVisibility) => {
    onVisibilityChange({
      ...visibility,
      [column]: !visibility[column],
    });
  };

  const visibleCount = Object.values(visibility).filter(Boolean).length;
  const totalCount = Object.keys(visibility).length;

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
        <DropdownMenuCheckboxItem
          checked={visibility.account}
          onCheckedChange={() => handleToggle("account")}
        >
          Account
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibility.owner}
          onCheckedChange={() => handleToggle("owner")}
        >
          Owner
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibility.stage}
          onCheckedChange={() => handleToggle("stage")}
        >
          Stage
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibility.forecastCategory}
          onCheckedChange={() => handleToggle("forecastCategory")}
        >
          Forecast
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibility.amountArr}
          onCheckedChange={() => handleToggle("amountArr")}
        >
          ARR
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibility.confidenceLevel}
          onCheckedChange={() => handleToggle("confidenceLevel")}
        >
          Confidence
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibility.closeDate}
          onCheckedChange={() => handleToggle("closeDate")}
        >
          Close Date
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibility.daysLeft}
          onCheckedChange={() => handleToggle("daysLeft")}
        >
          Days Left
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={visibility.nextStep}
          onCheckedChange={() => handleToggle("nextStep")}
        >
          Next Step
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
