"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";
import { Opportunity, KanbanColumnConfig } from "@/types/opportunity";
import { DraggableOpportunityCard } from "./DraggableOpportunityCard";
import { updateColumn } from "@/lib/api/columns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface KanbanColumnProps {
  column: KanbanColumnConfig;
  opportunities: Opportunity[];
  onOpenOpportunity?: (id: string) => void;
}

export function KanbanColumn({ column, opportunities, onOpenOpportunity }: KanbanColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(column.title);
  const count = opportunities.length;
  const { setNodeRef } = useDroppable({ id: column.id });
  const router = useRouter();

  const handleSave = async () => {
    if (!editedTitle.trim()) {
      toast.error("Column title cannot be empty");
      return;
    }

    try {
      await updateColumn(column.id, { title: editedTitle.trim() });
      toast.success("Column updated successfully");
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update column");
    }
  };

  const handleCancel = () => {
    setEditedTitle(column.title);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col bg-muted/30 rounded-lg border group" style={{ borderTopColor: column.color || undefined, borderTopWidth: column.color ? "3px" : undefined }}>
      <div className="p-3 flex items-center justify-between gap-2">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <Button size="sm" variant="ghost" onClick={handleSave} className="h-8 w-8 p-0">
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-medium">
              {column.title}
              <span className="text-muted-foreground font-normal"> ({count})</span>
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(true)}
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
      <Separator />
      <ScrollArea className="h-[70vh] p-3">
        <SortableContext
          id={column.id}
          items={opportunities.map((opp) => opp.id)}
          strategy={verticalListSortingStrategy}
        >
          <div ref={setNodeRef} className="space-y-3 min-h-[200px]">
            {opportunities.map((opp) => (
              <DraggableOpportunityCard
                key={opp.id}
                opportunity={opp}
                onClick={onOpenOpportunity}
              />
            ))}
            {count === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                No opportunities
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

export default KanbanColumn;


