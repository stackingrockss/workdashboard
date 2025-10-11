"use client";

import { useMemo } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { defaultColumns } from "@/data/mock-opportunities";
import { Opportunity, OpportunityStage } from "@/types/opportunity";
import { KanbanColumn } from "./KanbanColumn";
import { OpportunityCard } from "./OpportunityCard";

export interface KanbanBoardProps {
  opportunities: Opportunity[];
  onStageChange?: (opportunityId: string, newStage: OpportunityStage) => Promise<void>;
}

export function KanbanBoard({ opportunities, onStageChange }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const grouped = useMemo(() => {
    const result: Record<OpportunityStage, Opportunity[]> = {
      prospect: [],
      qualification: [],
      proposal: [],
      negotiation: [],
      closedWon: [],
      closedLost: [],
    };

    for (const opp of opportunities) {
      result[opp.stage].push(opp);
    }
    return result;
  }, [opportunities]);

  const activeOpportunity = useMemo(() => {
    if (!activeId) return null;
    return opportunities.find((opp) => opp.id === activeId);
  }, [activeId, opportunities]);

  const handleOpen = (id: string) => {
    window.location.href = `/opportunities/${id}`;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const opportunityId = active.id as string;
    const newStage = over.id as OpportunityStage;

    const opportunity = opportunities.find((opp) => opp.id === opportunityId);
    if (!opportunity || opportunity.stage === newStage) return;

    if (onStageChange) {
      await onStageChange(opportunityId, newStage);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {defaultColumns.map((col) => (
          <KanbanColumn
            key={col.id}
            stage={col.id}
            title={col.title}
            opportunities={grouped[col.id]}
            onOpenOpportunity={handleOpen}
          />
        ))}
      </div>
      <DragOverlay>
        {activeOpportunity ? (
          <OpportunityCard opportunity={activeOpportunity} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default KanbanBoard;


