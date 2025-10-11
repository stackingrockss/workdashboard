"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { defaultColumns } from "@/data/mock-opportunities";
import { Opportunity, OpportunityStage } from "@/types/opportunity";
import { KanbanColumn } from "./KanbanColumn";
import { Plus } from "lucide-react";

export interface KanbanBoardProps {
  opportunities: Opportunity[];
}

export function KanbanBoard({ opportunities }: KanbanBoardProps) {
  const [filterText, setFilterText] = useState("");

  const grouped = useMemo(() => {
    const result: Record<OpportunityStage, Opportunity[]> = {
      prospect: [],
      qualification: [],
      proposal: [],
      negotiation: [],
      closedWon: [],
      closedLost: [],
    };

    const normalized = filterText.trim().toLowerCase();
    const filtered = normalized
      ? opportunities.filter(
          (o) =>
            o.name.toLowerCase().includes(normalized) ||
            o.account.toLowerCase().includes(normalized)
        )
      : opportunities;

    for (const opp of filtered) {
      result[opp.stage].push(opp);
    }
    return result;
  }, [opportunities, filterText]);

  const handleOpen = (id: string) => {
    window.location.href = `/opportunities/${id}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="kanban-search">Search opportunities</label>
          <Input
            id="kanban-search"
            className="w-[260px]"
            placeholder="Search by name or account"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => alert("New opportunity")}> 
            <Plus className="h-4 w-4 mr-2" /> New Opportunity
          </Button>
        </div>
      </div>
      <Separator />
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
    </div>
  );
}

export default KanbanBoard;


