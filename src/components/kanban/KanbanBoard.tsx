"use client";

import { useMemo } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { Opportunity, OpportunityStage, KanbanColumnConfig } from "@/types/opportunity";
import { KanbanColumn } from "./KanbanColumn";
import { OpportunityCard } from "./OpportunityCard";

export interface KanbanBoardProps {
  opportunities: Opportunity[];
  columns: KanbanColumnConfig[];
  onStageChange?: (opportunityId: string, newStage: OpportunityStage) => Promise<void>;
}

export function KanbanBoard({ opportunities, columns, onStageChange }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const grouped = useMemo(() => {
    const result: Record<string, Opportunity[]> = {};

    // Initialize with column IDs
    for (const col of columns) {
      result[col.id] = [];
    }

    // Group opportunities by columnId, fallback to stage for backward compatibility
    for (const opp of opportunities) {
      const key = opp.columnId || opp.stage;
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(opp);
    }
    return result;
  }, [opportunities, columns]);

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
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 6)}, minmax(280px, 1fr))` }}>
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            opportunities={grouped[col.id] || []}
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


