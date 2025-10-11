"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Plus, Filter } from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { Opportunity, OpportunityStage } from "@/types/opportunity";
import { createOpportunity, updateOpportunity } from "@/lib/api/opportunities";
import { OpportunityCreateInput } from "@/lib/validations/opportunity";

interface KanbanBoardWrapperProps {
  opportunities: Opportunity[];
}

export function KanbanBoardWrapper({ opportunities }: KanbanBoardWrapperProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Get unique quarters from opportunities
  const quarters = useMemo(() => {
    const uniqueQuarters = new Set<string>();
    opportunities.forEach(opp => {
      if (opp.quarter) {
        uniqueQuarters.add(opp.quarter);
      }
    });
    return Array.from(uniqueQuarters).sort();
  }, [opportunities]);

  // Filter opportunities based on quarter and search
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(opp => {
      // Quarter filter
      if (selectedQuarter !== "all") {
        if (selectedQuarter === "unassigned") {
          if (opp.quarter) return false;
        } else if (opp.quarter !== selectedQuarter) {
          return false;
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const accountName = opp.account?.name || opp.accountName || "";
        return (
          opp.name.toLowerCase().includes(query) ||
          accountName.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [opportunities, selectedQuarter, searchQuery]);

  const handleCreateOpportunity = async (data: OpportunityCreateInput) => {
    try {
      await createOpportunity(data);
      toast.success("Opportunity created successfully!");
      setIsCreateDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create opportunity");
    }
  };

  const handleStageChange = async (opportunityId: string, newStage: OpportunityStage) => {
    try {
      await updateOpportunity(opportunityId, { stage: newStage });
      toast.success("Opportunity moved successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move opportunity");
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="kanban-search">
            Search opportunities
          </label>
          <Input
            id="kanban-search"
            className="w-[260px]"
            placeholder="Search by name or account"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Quarters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quarters</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {quarters.map(quarter => (
                <SelectItem key={quarter} value={quarter}>
                  {quarter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Opportunity
          </Button>
        </div>
      </div>
      <Separator />
      <KanbanBoard opportunities={filteredOpportunities} onStageChange={handleStageChange} />

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Opportunity</DialogTitle>
          </DialogHeader>
          <OpportunityForm
            onSubmit={handleCreateOpportunity}
            onCancel={() => setIsCreateDialogOpen(false)}
            submitLabel="Create Opportunity"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
