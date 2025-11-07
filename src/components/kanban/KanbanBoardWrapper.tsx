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
import { Plus, Filter, Columns, FileText, Copy } from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import { ViewSelector } from "./ViewSelector";
import { WelcomeViewDialog } from "./WelcomeViewDialog";
import { ManageViewsDialog } from "./ManageViewsDialog";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { ColumnForm } from "@/components/forms/column-form";
import { ParseGongTranscriptDialog } from "@/components/features/opportunities/parse-gong-transcript-dialog";
import { Opportunity, OpportunityStage, getDefaultConfidenceLevel, getDefaultForecastCategory } from "@/types/opportunity";
import { SerializedKanbanView, SerializedKanbanColumn, isBuiltInView } from "@/types/view";
import { createOpportunity, updateOpportunity } from "@/lib/api/opportunities";
import { OpportunityCreateInput } from "@/lib/validations/opportunity";
import { createColumn } from "@/lib/api/columns";
import { ColumnCreateInput } from "@/lib/validations/column";
import { createView, activateView, duplicateView } from "@/lib/api/views";
import { ViewType } from "@prisma/client";

interface KanbanBoardWrapperProps {
  opportunities: Opportunity[];
  views: SerializedKanbanView[];
  activeView: SerializedKanbanView;
  isNewUser?: boolean;
  userId?: string;
  organizationId?: string;
  fiscalYearStartMonth?: number;
}

export function KanbanBoardWrapper({
  opportunities,
  views: initialViews,
  activeView: initialActiveView,
  isNewUser = false,
  userId,
  organizationId,
  fiscalYearStartMonth = 1
}: KanbanBoardWrapperProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [isWelcomeDialogOpen, setIsWelcomeDialogOpen] = useState(false);
  const [isManageViewsDialogOpen, setIsManageViewsDialogOpen] = useState(false);
  const [isParseTranscriptDialogOpen, setIsParseTranscriptDialogOpen] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Show welcome dialog for new users
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("kanban-welcome-seen");
    if (isNewUser && !hasSeenWelcome) {
      setIsWelcomeDialogOpen(true);
    }
  }, [isNewUser]);

  // Get display columns based on active view
  const displayColumns = useMemo(() => {
    return activeView.columns;
  }, [activeView]);

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

  // Filter opportunities based on quarter and search
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

  // Check if current view is read-only (built-in view)
  const isReadOnlyView = isBuiltInView(activeView.id);

  // Handle view selection (optimistic update)
  const handleSelectView = async (viewId: string) => {
    // Find the view
    const newView = views.find(v => v.id === viewId);
    if (!newView) return;

    // Optimistic update
    setActiveView(newView);

    try {
      // Update on server (only for custom views)
      if (!isBuiltInView(viewId)) {
        await activateView(viewId);
      }

      // Refresh to sync
      router.refresh();
    } catch (error) {
      console.error("Error activating view:", error);
      toast.error("Failed to switch view");
      // Rollback would happen on refresh
    }
  };

  // Handle creating a new custom view
  const handleCreateView = async () => {
    try {
      const newView = await createView({
        name: "New Custom View",
        viewType: "custom",
        userId,
        organizationId,
      });

      toast.success("View created! You can rename it in Manage Views.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create view");
    }
  };

  // Handle welcome dialog view selection
  const handleWelcomeViewSelection = async (viewType: ViewType) => {
    try {
      if (viewType === "custom") {
        // Create blank custom view
        await createView({
          name: "My Custom View",
          viewType: "custom",
          userId,
          organizationId,
          isDefault: true,
        });
      } else {
        // For built-in views, just activate them (they're already in the list)
        const builtInView = views.find(v => v.viewType === viewType && isBuiltInView(v.id));
        if (builtInView) {
          setActiveView(builtInView);
        }
      }

      localStorage.setItem("kanban-welcome-seen", "true");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set up view");
      throw error;
    }
  };

  // Handle duplicating built-in view to custom
  const handleDuplicateView = async () => {
    try {
      await duplicateView(activeView.id, {
        newName: `${activeView.name} (Custom)`,
        includeColumns: true,
      });

      toast.success("View duplicated as custom view!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate view");
    }
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
      // Refresh in background to sync with server (non-blocking)
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
      const maxOrder = displayColumns.length > 0 ? Math.max(...displayColumns.map(c => c.order)) : -1;
      await createColumn({
        ...data,
        order: maxOrder + 1,
        viewId: activeView.id
      });
      toast.success("Column created successfully!");
      setIsColumnDialogOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create column");
    }
  };

  const handleViewsChanged = () => {
    router.refresh();
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
          {/* View Selector */}
          <ViewSelector
            views={views}
            activeView={activeView}
            onSelectView={handleSelectView}
            onCreateView={handleCreateView}
            onManageViews={() => setIsManageViewsDialogOpen(true)}
          />

          {/* Duplicate built-in view button */}
          {isReadOnlyView && (
            <Button size="sm" variant="outline" onClick={handleDuplicateView}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate as Custom
            </Button>
          )}

          {/* Add Column Button (only for custom views) */}
          {!isReadOnlyView && (
            <Button size="sm" variant="outline" onClick={() => setIsColumnDialogOpen(true)}>
              <Columns className="h-4 w-4 mr-2" />
              Add Column
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsParseTranscriptDialogOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" /> Parse Gong Transcript
          </Button>

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
        isVirtualMode={isReadOnlyView}
        fiscalYearStartMonth={fiscalYearStartMonth}
      />

      {/* Create Opportunity Dialog */}
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

      {/* Add Column Dialog */}
      <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Column</DialogTitle>
          </DialogHeader>
          <ColumnForm
            onSubmit={handleCreateColumn}
            onCancel={() => setIsColumnDialogOpen(false)}
            submitLabel="Add Column"
            defaultOrder={displayColumns.length}
          />
        </DialogContent>
      </Dialog>

      {/* Welcome View Dialog (for new users) */}
      <WelcomeViewDialog
        open={isWelcomeDialogOpen}
        onOpenChange={setIsWelcomeDialogOpen}
        onSelectViewType={handleWelcomeViewSelection}
      />

      {/* Manage Views Dialog */}
      <ManageViewsDialog
        open={isManageViewsDialogOpen}
        onOpenChange={setIsManageViewsDialogOpen}
        views={views}
        onViewsChanged={handleViewsChanged}
      />

      {/* Parse Gong Transcript Dialog */}
      <ParseGongTranscriptDialog
        open={isParseTranscriptDialogOpen}
        onOpenChange={setIsParseTranscriptDialogOpen}
      />
    </div>
  );
}
