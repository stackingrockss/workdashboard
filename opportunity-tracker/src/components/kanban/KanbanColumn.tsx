"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Opportunity, OpportunityStage } from "@/types/opportunity";
import { DraggableOpportunityCard } from "./DraggableOpportunityCard";

export interface KanbanColumnProps {
  stage: OpportunityStage;
  title: string;
  opportunities: Opportunity[];
  onOpenOpportunity?: (id: string) => void;
}

export function KanbanColumn({ stage, title, opportunities, onOpenOpportunity }: KanbanColumnProps) {
  const count = opportunities.length;
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div className="flex flex-col bg-muted/30 rounded-lg border">
      <div className="p-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {title}
          <span className="text-muted-foreground font-normal"> ({count})</span>
        </h3>
      </div>
      <Separator />
      <ScrollArea className="h-[70vh] p-3">
        <SortableContext
          id={stage}
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


