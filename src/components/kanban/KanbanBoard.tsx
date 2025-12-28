"use client";

import { useMemo, useCallback } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { Opportunity, OpportunityStage } from "@/types/opportunity";
import { SerializedKanbanColumn } from "@/types/view";
import { KanbanColumn } from "./KanbanColumn";
import { OpportunityCard } from "./OpportunityCard";
import { groupOpportunitiesByQuarter, calculateCloseDateFromVirtualColumn } from "@/lib/utils/quarterly-view";
import { groupOpportunitiesByForecast, columnIdToForecastCategory } from "@/lib/utils/forecast-view";
import { groupOpportunitiesByStage, columnIdToStage } from "@/lib/utils/stages-view";
import { groupOpportunitiesByClosedLost } from "@/lib/utils/closed-lost-view";
import { groupOpportunitiesByCustomerValue } from "@/lib/utils/customers-view";

export interface KanbanBoardProps {
  opportunities: Opportunity[];
  columns: SerializedKanbanColumn[];
  onStageChange?: (opportunityId: string, newStage: OpportunityStage) => Promise<void>;
  onColumnChange?: (opportunityId: string, newColumnId: string, newCloseDate?: string | null) => Promise<void>;
  isVirtualMode?: boolean;
  fiscalYearStartMonth?: number;
  showOwner?: boolean;
}

export function KanbanBoard({
  opportunities,
  columns,
  onColumnChange,
  isVirtualMode = false,
  fiscalYearStartMonth = 1,
  showOwner = false,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [movingOpportunityId, setMovingOpportunityId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group opportunities by columnId (custom mode) or by quarter/forecast/stage/etc (virtual mode)
  const grouped = useMemo(() => {
    if (isVirtualMode && columns.length > 0) {
      // Determine which virtual mode we're in based on column ID prefix
      const firstColumnId = columns[0].id;

      if (firstColumnId.startsWith("virtual-Q")) {
        // Quarterly view: group by calculated quarter from close date
        return groupOpportunitiesByQuarter(opportunities, fiscalYearStartMonth);
      } else if (firstColumnId.startsWith("virtual-forecast-")) {
        // Forecast Categories view: group by forecast category
        return groupOpportunitiesByForecast(opportunities);
      } else if (firstColumnId.startsWith("virtual-stage-")) {
        // Sales Stages view: group by opportunity stage
        return groupOpportunitiesByStage(opportunities);
      } else if (firstColumnId.startsWith("virtual-closedlost-")) {
        // Closed Lost view: group by time period (only closedLost opportunities)
        return groupOpportunitiesByClosedLost(opportunities);
      } else if (firstColumnId.startsWith("virtual-customers-")) {
        // Customers view: group by ARR value (only closedWon opportunities)
        return groupOpportunitiesByCustomerValue(opportunities);
      }
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

  const handleOpen = useCallback((id: string) => {
    window.location.href = `/opportunities/${id}`;
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
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

    // Set loading state
    setMovingOpportunityId(opportunityId);

    try {
      if (isVirtualMode) {
        // Determine which virtual mode we're in
        if (newColumnId.startsWith("virtual-Q")) {
          // Quarterly mode: Calculate new close date from virtual column
          const newCloseDate = calculateCloseDateFromVirtualColumn(newColumnId, fiscalYearStartMonth);

          // Check if the opportunity is already in this quarter
          const currentCloseDate = opportunity.closeDate ? new Date(opportunity.closeDate).toISOString() : null;
          if (currentCloseDate === newCloseDate) return; // No change needed

          // Update close date (which will automatically update the quarter)
          if (onColumnChange) {
            await onColumnChange(opportunityId, newColumnId, newCloseDate);
          }
        } else if (newColumnId.startsWith("virtual-forecast-")) {
          // Forecast Categories mode: Update forecast category
          const newForecastCategory = columnIdToForecastCategory(newColumnId);
          if (!newForecastCategory) return;

          // Check if already in this category
          if (opportunity.forecastCategory === newForecastCategory) return;

          // Update forecast category via API
          if (onColumnChange) {
            await onColumnChange(opportunityId, newColumnId);
          }
        } else if (newColumnId.startsWith("virtual-stage-")) {
          // Sales Stages mode: Update opportunity stage
          const newStage = columnIdToStage(newColumnId);
          if (!newStage) return;

          // Check if already in this stage
          if (opportunity.stage === newStage) return;

          // Update stage via API
          if (onColumnChange) {
            await onColumnChange(opportunityId, newColumnId);
          }
        }
      } else {
        // Custom mode: Update columnId directly
        // No change if already in this column
        if (opportunity.columnId === newColumnId) return;

        // Update columnId
        if (onColumnChange) {
          await onColumnChange(opportunityId, newColumnId);
        }
      }
    } finally {
      setMovingOpportunityId(null);
    }
  }, [opportunities, columns, isVirtualMode, fiscalYearStartMonth, onColumnChange]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent lg:grid lg:pb-0"
        style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 6)}, minmax(280px, 1fr))` }}
      >
        {columns.map((col) => (
          <div key={col.id} className="flex-shrink-0 w-[85vw] snap-center sm:w-[45vw] lg:w-auto lg:flex-shrink">
            <KanbanColumn
              column={col}
              opportunities={grouped[col.id] || []}
              onOpenOpportunity={handleOpen}
              isVirtualMode={isVirtualMode}
              movingOpportunityId={movingOpportunityId}
              showOwner={showOwner}
            />
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeOpportunity ? (
          <OpportunityCard opportunity={activeOpportunity} showOwner={showOwner} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default KanbanBoard;
