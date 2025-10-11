"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Opportunity, OpportunityStage } from "@/types/opportunity";
import OpportunityCard from "./OpportunityCard";

export interface KanbanColumnProps {
  stage: OpportunityStage;
  title: string;
  opportunities: Opportunity[];
  onOpenOpportunity?: (id: string) => void;
}

export function KanbanColumn({ stage, title, opportunities, onOpenOpportunity }: KanbanColumnProps) {
  const count = opportunities.length;
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
        <div className="space-y-3">
          {opportunities.map((opp) => (
            <OpportunityCard
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
      </ScrollArea>
    </div>
  );
}

export default KanbanColumn;


