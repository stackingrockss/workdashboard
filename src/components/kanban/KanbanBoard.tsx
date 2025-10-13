"use client";

import { useMemo } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { Opportunity, OpportunityStage, KanbanColumnConfig } from "@/types/opportunity";
import { KanbanColumn } from "./KanbanColumn";
import { OpportunityCard } from "./OpportunityCard";
import { groupOpportunitiesByQuarter } from "@/lib/utils/quarterly-view";

export interface KanbanBoardProps {
  opportunities: Opportunity[];
  columns: KanbanColumnConfig[];
  onStageChange?: (opportunityId: string, newStage: OpportunityStage) => Promise<void>;
  onColumnChange?: (opportunityId: string, newColumnId: string) => Promise<void>;
  isVirtualMode?: boolean;
  fiscalYearStartMonth?: number;
}

export function KanbanBoard({
  opportunities,
  columns,
  onStageChange,
  onColumnChange,
  isVirtualMode = false,
  fiscalYearStartMonth = 1,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group opportunities by columnId (custom mode) or by quarter (virtual mode)
  const grouped = useMemo(() => {
    if (isVirtualMode) {
      // Virtual mode: group by calculated quarter from close date
      return groupOpportunitiesByQuarter(opportunities, fiscalYearStartMonth);
    }

    // Custom mode: group by columnId
    const result: Record<string, Opportunity[]> = {};

    // Initialize with column IDs
    for (const col of columns) {
      result[col.id] = [];
    }

    // Group opportunities by columnId only (no stage fallback)
    for (const opp of opportunities) {
      if (opp.columnId && result[opp.columnId]) {
        result[opp.columnId].push(opp);
      }
      // Skip opportunities without a valid columnId - they won't be displayed
    }
    return result;
  }, [isVirtualMode, opportunities, columns, fiscalYearStartMonth]);

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
    const newColumnId = over.id as string;

    const opportunity = opportunities.find((opp) => opp.id === opportunityId);
    if (!opportunity) return;

    // Only allow dropping onto valid columns
    const targetColumn = columns.find(col => col.id === newColumnId);
    if (!targetColumn) return; // Invalid drop target

    // In virtual mode, drag-and-drop is disabled (read-only)
    if (isVirtualMode) {
      return;
    }

    // No change if already in this column
    if (opportunity.columnId === newColumnId) return;

    // Update columnId
    if (onColumnChange) {
      await onColumnChange(opportunityId, newColumnId);
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
            isVirtualMode={isVirtualMode}
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
