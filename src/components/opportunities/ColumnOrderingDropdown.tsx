"use client";

import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { ColumnConfig } from "@/lib/config/current-quarter-columns";

interface ColumnOrderingDropdownProps {
  columns: string[];
  columnConfigs: Record<string, ColumnConfig>;
  onReorder: (newOrder: string[]) => void;
}

interface SortableColumnItemProps {
  id: string;
  label: string;
}

function SortableColumnItem({ id, label }: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-background border rounded hover:bg-muted/50 transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex items-center">
        <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      </div>
      <span className="text-sm flex-1">{label}</span>
    </div>
  );
}

export function ColumnOrderingDropdown({ columns, columnConfigs, onReorder }: ColumnOrderingDropdownProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = columns.indexOf(active.id as string);
    const newIndex = columns.indexOf(over.id as string);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(columns, oldIndex, newIndex);
    onReorder(newOrder);
    toast.success("Column order saved");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <GripVertical className="h-4 w-4 mr-2" />
          Reorder Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[250px] max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel>Drag to reorder</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 p-2">
              {columns.map((colId) => (
                <SortableColumnItem
                  key={colId}
                  id={colId}
                  label={columnConfigs[colId]?.label || colId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
