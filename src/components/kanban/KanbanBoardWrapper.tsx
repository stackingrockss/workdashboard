"use client";

/**
 * KanbanBoardWrapper Component
 * Main wrapper for the Kanban board with view management, filtering, and dialogs
 */

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, LayoutGrid, Table, Search, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { KanbanBoard } from "./KanbanBoard";
import { ViewSelector } from "./ViewSelector";
import { OpportunitiesListView } from "@/components/opportunities/OpportunitiesListView";
import { OpportunityForm } from "@/components/forms/OpportunityForm";
import { Opportunity, OpportunityStage, getDefaultConfidenceLevel, getDefaultForecastCategory } from "@/types/opportunity";
import { SerializedKanbanView } from "@/types/view";
import { createOpportunity, updateOpportunity } from "@/lib/api/opportunities";
import { OpportunityCreateInput } from "@/lib/validations/opportunity";
import { formatDateShort } from "@/lib/format";
import { getQuarterFromDate } from "@/lib/utils/quarter";

interface KanbanBoardWrapperProps {
  opportunities: Opportunity[];
  views: SerializedKanbanView[];
  activeView: SerializedKanbanView;
  fiscalYearStartMonth?: number;
}

export function KanbanBoardWrapper({
  opportunities,
  views: initialViews,
  activeView: initialActiveView,
  fiscalYearStartMonth = 1
}: KanbanBoardWrapperProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  // Local state for views and active view (for optimistic updates)
  const [views, setViews] = useState<SerializedKanbanView[]>(initialViews);
  const [activeView, setActiveView] = useState<SerializedKanbanView>(initialActiveView);

  // Local state for opportunities (for optimistic updates)
  const [localOpportunities, setLocalOpportunities] = useState<Opportunity[]>(opportunities);

  const router = useRouter();

  // Sync local state with server data
  useEffect(() => {
    setLocalOpportunities(opportunities);
  }, [opportunities]);

  useEffect(() => {
    setViews(initialViews);
  }, [initialViews]);

  useEffect(() => {
    setActiveView(initialActiveView);
  }, [initialActiveView]);

  // Persist view mode preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem("opportunities-view-mode");
      if (savedViewMode === "board" || savedViewMode === "list") {
        setViewMode(savedViewMode);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("opportunities-view-mode", viewMode);
    }
  }, [viewMode]);


  // Get display columns based on active view
  const displayColumns = useMemo(() => {
    // For quarterly view, regenerate columns dynamically from opportunities
    if (activeView.viewType === "quarterly") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { generateQuarterlyColumns } = require("@/lib/utils/quarterly-view");
      return generateQuarterlyColumns(localOpportunities, fiscalYearStartMonth);
    }
    return activeView.columns;
  }, [activeView, localOpportunities, fiscalYearStartMonth]);

  // Filter opportunities based on search
  const filteredOpportunities = useMemo(() => {
    if (!searchQuery) return localOpportunities;

    const query = searchQuery.toLowerCase();
    return localOpportunities.filter(opp => {
      const accountName = opp.account?.name || opp.accountName || "";
      return (
        opp.name.toLowerCase().includes(query) ||
        accountName.toLowerCase().includes(query)
      );
    });
  }, [localOpportunities, searchQuery]);

  // Handle view selection
  const handleSelectView = (viewId: string) => {
    const newView = views.find(v => v.id === viewId);
    if (!newView) return;

    // Optimistic update
    setActiveView(newView);

    // Auto-switch to list view for Current Quarter (since it's a list-only view)
    if (newView.viewType === "currentQuarter") {
      setViewMode("list");
    }

    // Store the selected view ID in a cookie for server-side rendering
    if (typeof document !== 'undefined') {
      document.cookie = `selected-built-in-view=${viewId}; path=/; max-age=${60 * 60 * 24 * 365}`; // 1 year
    }

    router.refresh();
  };

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
      await updateOpportunity(opportunityId, {
        stage: newStage,
        confidenceLevel: getDefaultConfidenceLevel(newStage),
        forecastCategory: getDefaultForecastCategory(newStage),
      });
      toast.success("Opportunity moved successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move opportunity");
      throw error;
    }
  };

  const handleColumnChange = async (opportunityId: string, newColumnId: string, newCloseDate?: string | null) => {
    const previousOpportunities = [...localOpportunities];

    const isQuarterlyUpdate = newCloseDate !== undefined;
    const isForecastUpdate = newColumnId.startsWith("virtual-forecast-");
    const isStageUpdate = newColumnId.startsWith("virtual-stage-");

    if (isQuarterlyUpdate) {
      setLocalOpportunities(prev =>
        prev.map(opp => {
          if (opp.id === opportunityId) {
            const newQuarter = newCloseDate
              ? getQuarterFromDate(new Date(newCloseDate), fiscalYearStartMonth)
              : undefined;
            return {
              ...opp,
              closeDate: newCloseDate || undefined,
              quarter: newQuarter,
            };
          }
          return opp;
        })
      );

      try {
        await updateOpportunity(opportunityId, { closeDate: newCloseDate || undefined });

        if (newCloseDate) {
          toast.success(`Close date updated to ${formatDateShort(newCloseDate)}`);
        } else {
          toast.success("Close date cleared");
        }

        router.refresh();
      } catch (error) {
        setLocalOpportunities(previousOpportunities);
        toast.error(error instanceof Error ? error.message : "Failed to update close date");
        throw error;
      }
    } else if (isForecastUpdate) {
      const { columnIdToForecastCategory } = await import("@/lib/utils/forecast-view");
      const newForecastCategory = columnIdToForecastCategory(newColumnId);

      if (!newForecastCategory) {
        toast.error("Invalid forecast category");
        return;
      }

      setLocalOpportunities(prev =>
        prev.map(opp =>
          opp.id === opportunityId
            ? { ...opp, forecastCategory: newForecastCategory }
            : opp
        )
      );

      try {
        await updateOpportunity(opportunityId, { forecastCategory: newForecastCategory });
        const { getForecastCategoryLabel } = await import("@/types/opportunity");
        toast.success(`Moved to ${getForecastCategoryLabel(newForecastCategory)}`);
        router.refresh();
      } catch (error) {
        setLocalOpportunities(previousOpportunities);
        toast.error(error instanceof Error ? error.message : "Failed to update forecast category");
        throw error;
      }
    } else if (isStageUpdate) {
      const { columnIdToStage } = await import("@/lib/utils/stages-view");
      const newStage = columnIdToStage(newColumnId);

      if (!newStage) {
        toast.error("Invalid stage");
        return;
      }

      setLocalOpportunities(prev =>
        prev.map(opp =>
          opp.id === opportunityId
            ? { ...opp, stage: newStage }
            : opp
        )
      );

      try {
        await updateOpportunity(opportunityId, { stage: newStage });
        const { getStageLabel } = await import("@/types/opportunity");
        toast.success(`Moved to ${getStageLabel(newStage)}`);
        router.refresh();
      } catch (error) {
        setLocalOpportunities(previousOpportunities);
        toast.error(error instanceof Error ? error.message : "Failed to update stage");
        throw error;
      }
    }
  };

  const handleOpportunityUpdate = async (id: string, updates: Partial<Opportunity>) => {
    const previousOpportunities = localOpportunities;

    setLocalOpportunities(prev =>
      prev.map(opp => {
        if (opp.id === id) {
          const updated = { ...opp, ...updates };
          if (updates.closeDate !== undefined) {
            updated.quarter = updates.closeDate
              ? getQuarterFromDate(new Date(updates.closeDate), fiscalYearStartMonth)
              : undefined;
          }
          return updated;
        }
        return opp;
      })
    );

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const apiUpdates: any = { ...updates };
      if ('account' in apiUpdates && typeof apiUpdates.account === 'object') {
        delete apiUpdates.account;
      }

      await updateOpportunity(id, apiUpdates);
      toast.success("Opportunity updated");
      router.refresh();
    } catch (error) {
      setLocalOpportunities(previousOpportunities);
      toast.error(error instanceof Error ? error.message : "Failed to update opportunity");
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="kanban-search"
            className="w-[260px] pl-9"
            placeholder="Search opportunities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search opportunities by name or account"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* View Selector */}
          <ViewSelector
            views={views}
            activeView={activeView}
            onSelectView={handleSelectView}
          />

          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Opportunity
          </Button>
        </div>
      </div>

      <Separator />

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "board" | "list")}>
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="board" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Table className="h-4 w-4" />
            List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          {activeView.viewType === "currentQuarter" ? (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  Board view is available for Quarterly, Stages, and Forecast views
                </p>
                <p className="text-sm">
                  Current Quarter is optimized for the list view, or select a different view from the dropdown.
                </p>
              </div>
            </Card>
          ) : (
            <KanbanBoard
              opportunities={filteredOpportunities}
              columns={displayColumns}
              onStageChange={handleStageChange}
              onColumnChange={handleColumnChange}
              isVirtualMode={true}
              fiscalYearStartMonth={fiscalYearStartMonth}
            />
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <OpportunitiesListView
            opportunities={localOpportunities}
            fiscalYearStartMonth={fiscalYearStartMonth}
            activeView={activeView}
            onOpportunityUpdate={handleOpportunityUpdate}
          />
        </TabsContent>
      </Tabs>

      {/* Create Opportunity Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Opportunity</DialogTitle>
            <DialogDescription>
              Add a new sales opportunity to your pipeline. Fill in the required fields below.
            </DialogDescription>
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
