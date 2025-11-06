"use client";

import { useState, useMemo, useEffect } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Plus, Filter, Columns, LayoutGrid, CalendarDays, ChevronDown, Sparkles } from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { ColumnForm } from "@/components/forms/column-form";
import { ColumnTemplateDialog } from "./ColumnTemplateDialog";
import { Opportunity, OpportunityStage, KanbanColumnConfig, getDefaultProbability, getDefaultForecastCategory } from "@/types/opportunity";
import { createOpportunity, updateOpportunity } from "@/lib/api/opportunities";
import { OpportunityCreateInput } from "@/lib/validations/opportunity";
import { getColumns, createColumn } from "@/lib/api/columns";
import { ColumnCreateInput } from "@/lib/validations/column";
import { generateQuarterlyColumns, groupOpportunitiesByQuarter } from "@/lib/utils/quarterly-view";
import { getTemplateById, prepareTemplateForCreation, type ColumnTemplateType } from "@/lib/templates/column-templates";

type ViewMode = "custom" | "quarterly";

interface KanbanBoardWrapperProps {
  opportunities: Opportunity[];
  initialColumns?: KanbanColumnConfig[];
  fiscalYearStartMonth?: number;
}

export function KanbanBoardWrapper({
  opportunities,
  initialColumns,
  fiscalYearStartMonth = 1
}: KanbanBoardWrapperProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isWelcomeDialogOpen, setIsWelcomeDialogOpen] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [columns, setColumns] = useState<KanbanColumnConfig[]>(initialColumns || []);
  const [viewMode, setViewMode] = useState<ViewMode>("custom");
  // Local state for optimistic updates
  const [localOpportunities, setLocalOpportunities] = useState<Opportunity[]>(opportunities);
  const router = useRouter();

  // Sync local opportunities with server data
  useEffect(() => {
    setLocalOpportunities(opportunities);
  }, [opportunities]);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("kanban-view-mode");
    if (savedMode === "quarterly" || savedMode === "custom") {
      setViewMode(savedMode);
    }
  }, []);

  // Save view mode preference to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("kanban-view-mode", mode);
  };

  // Fetch columns on mount if not provided
  useEffect(() => {
    if (!initialColumns) {
      getColumns().then(setColumns).catch((error) => {
        console.error("Failed to fetch columns:", error);
        toast.error("Failed to load kanban columns");
      });
    }
  }, [initialColumns]);

  // Show welcome dialog for new users (no columns)
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("kanban-welcome-seen");
    if (columns.length === 0 && !hasSeenWelcome) {
      setIsWelcomeDialogOpen(true);
      localStorage.setItem("kanban-welcome-seen", "true");
    }
  }, [columns.length]);

  // Generate virtual quarterly columns or use custom columns
  const displayColumns = useMemo(() => {
    if (viewMode === "quarterly") {
      return generateQuarterlyColumns(opportunities, fiscalYearStartMonth);
    }
    return columns;
  }, [viewMode, opportunities, columns, fiscalYearStartMonth]);

  // Get unique quarters from opportunities (for filter dropdown)
  const quarters = useMemo(() => {
    const uniqueQuarters = new Set<string>();
    opportunities.forEach(opp => {
      if (opp.quarter) {
        uniqueQuarters.add(opp.quarter);
      }
    });
    return Array.from(uniqueQuarters).sort();
  }, [opportunities]);

  // Filter opportunities based on quarter and search (use local state for instant updates)
  const filteredOpportunities = useMemo(() => {
    return localOpportunities.filter(opp => {
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
  }, [localOpportunities, selectedQuarter, searchQuery]);

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
        probability: getDefaultProbability(newStage),
        forecastCategory: getDefaultForecastCategory(newStage),
      });
      toast.success("Opportunity moved successfully!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move opportunity");
      throw error;
    }
  };

  const handleColumnChange = async (opportunityId: string, newColumnId: string) => {
    // Optimistic update: update local state immediately
    const previousOpportunities = [...localOpportunities];

    setLocalOpportunities(prev =>
      prev.map(opp =>
        opp.id === opportunityId
          ? { ...opp, columnId: newColumnId }
          : opp
      )
    );

    try {
      // Update on server in background
      await updateOpportunity(opportunityId, { columnId: newColumnId });
      // Refresh in background to sync with server (no await = non-blocking)
      router.refresh();
    } catch (error) {
      // Rollback on error
      setLocalOpportunities(previousOpportunities);
      toast.error(error instanceof Error ? error.message : "Failed to move opportunity");
      throw error;
    }
  };

  const handleCreateColumn = async (data: ColumnCreateInput) => {
    try {
      const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.order)) : -1;
      await createColumn({ ...data, order: maxOrder + 1 });
      toast.success("Column created successfully!");
      setIsColumnDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create column");
    }
  };

  const handleApplyTemplate = async (templateId: ColumnTemplateType, replaceExisting = false) => {
    try {
      // Get template with fiscal year configuration
      const template = getTemplateById(templateId, fiscalYearStartMonth);
      const columnsToCreate = prepareTemplateForCreation(template);

      // If replace mode, delete all existing columns first
      if (replaceExisting && columns.length > 0) {
        const { deleteColumn } = await import("@/lib/api/columns");
        for (const col of columns) {
          await deleteColumn(col.id);
        }
      }

      // Create columns via API
      for (const col of columnsToCreate) {
        await createColumn(col);
      }

      toast.success(`${template.name} template applied successfully!`);
      setIsTemplateDialogOpen(false);
      setIsWelcomeDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply template");
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
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <TooltipProvider>
            <Tabs value={viewMode} onValueChange={(value) => handleViewModeChange(value as ViewMode)}>
              <TabsList>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="custom" className="flex items-center gap-1.5">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Custom
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Show your custom columns (editable, renameable)</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger value="quarterly" className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Quarterly
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Virtual view grouped by close date quarter (read-only)</p>
                  </TooltipContent>
                </Tooltip>
              </TabsList>
            </Tabs>
          </TooltipProvider>

          {/* Enhanced Add Column Button with Dropdown */}
          {viewMode === "custom" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Columns className="h-4 w-4 mr-2" />
                  Add Column
                  <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setIsColumnDialogOpen(true)}>
                  <Columns className="h-4 w-4 mr-2" />
                  Add Single Column
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsTemplateDialogOpen(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Apply Template...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Opportunity
          </Button>
        </div>
      </div>
      <Separator />
      <KanbanBoard
        opportunities={filteredOpportunities}
        columns={displayColumns}
        onStageChange={handleStageChange}
        onColumnChange={handleColumnChange}
        isVirtualMode={viewMode === "quarterly"}
        fiscalYearStartMonth={fiscalYearStartMonth}
      />

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

      <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Column</DialogTitle>
          </DialogHeader>
          <ColumnForm
            onSubmit={handleCreateColumn}
            onCancel={() => setIsColumnDialogOpen(false)}
            submitLabel="Add Column"
            defaultOrder={columns.length}
          />
        </DialogContent>
      </Dialog>

      <ColumnTemplateDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        onSelectTemplate={handleApplyTemplate}
        fiscalYearStartMonth={fiscalYearStartMonth}
        hasExistingColumns={columns.length > 0}
      />

      {/* Welcome template picker for new users */}
      <ColumnTemplateDialog
        open={isWelcomeDialogOpen}
        onOpenChange={setIsWelcomeDialogOpen}
        onSelectTemplate={handleApplyTemplate}
        fiscalYearStartMonth={fiscalYearStartMonth}
        hasExistingColumns={false}
      />
    </div>
  );
}
