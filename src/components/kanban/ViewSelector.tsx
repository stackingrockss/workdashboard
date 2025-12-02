"use client";

/**
 * ViewSelector Component
 * Dropdown for selecting Kanban views (built-in views only)
 */

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SerializedKanbanView } from "@/types/view";

interface ViewSelectorProps {
  views: SerializedKanbanView[];
  activeView: SerializedKanbanView;
  onSelectView: (viewId: string) => void;
}

export function ViewSelector({
  views,
  activeView,
  onSelectView,
}: ViewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectView = (viewId: string) => {
    onSelectView(viewId);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[200px] justify-between">
          <span className="truncate">{activeView.name}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[280px]">
        {views.map((view) => (
          <DropdownMenuItem
            key={view.id}
            onClick={() => handleSelectView(view.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>{view.name}</span>
            {activeView.id === view.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
