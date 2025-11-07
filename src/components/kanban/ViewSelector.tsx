"use client";

/**
 * ViewSelector Component
 * Dropdown for selecting and managing Kanban views
 */

import { useState } from "react";
import { Check, ChevronDown, Plus, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SerializedKanbanView } from "@/types/view";
import { isBuiltInView } from "@/types/view";

interface ViewSelectorProps {
  views: SerializedKanbanView[];
  activeView: SerializedKanbanView;
  onSelectView: (viewId: string) => void;
  onCreateView: () => void;
  onManageViews: () => void;
}

export function ViewSelector({
  views,
  activeView,
  onSelectView,
  onCreateView,
  onManageViews,
}: ViewSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Separate built-in and custom views
  const builtInViews = views.filter((view) => isBuiltInView(view.id));
  const customViews = views.filter((view) => !isBuiltInView(view.id));

  const handleSelectView = (viewId: string) => {
    onSelectView(viewId);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="min-w-[200px] justify-between">
          <span className="truncate">{activeView.name}</span>
          {isBuiltInView(activeView.id) && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Read-only
            </Badge>
          )}
          <ChevronDown className="ml-2 h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[280px]">
        {/* Built-in Views Section */}
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase">
          Built-in Views
        </DropdownMenuLabel>
        {builtInViews.map((view) => (
          <DropdownMenuItem
            key={view.id}
            onClick={() => handleSelectView(view.id)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span>{view.name}</span>
              <Badge variant="outline" className="text-xs">
                Read-only
              </Badge>
            </div>
            {activeView.id === view.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}

        {customViews.length > 0 && <DropdownMenuSeparator />}

        {/* Custom Views Section */}
        {customViews.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase">
              Custom Views ({customViews.length})
            </DropdownMenuLabel>
            {customViews.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => handleSelectView(view.id)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="truncate">{view.name}</span>
                  {view.isDefault && (
                    <Badge variant="secondary" className="text-xs">
                      Default
                    </Badge>
                  )}
                </div>
                {activeView.id === view.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Actions */}
        <DropdownMenuItem
          onClick={() => {
            onCreateView();
            setIsOpen(false);
          }}
          className="cursor-pointer"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create New View
        </DropdownMenuItem>

        {customViews.length > 0 && (
          <DropdownMenuItem
            onClick={() => {
              onManageViews();
              setIsOpen(false);
            }}
            className="cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            Manage Views
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
