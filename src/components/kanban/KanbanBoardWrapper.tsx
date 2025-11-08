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
import { Plus, Filter, Columns, FileText, Eye, EyeOff } from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import { ViewSelector } from "./ViewSelector";
import { WelcomeViewDialog } from "./WelcomeViewDialog";
import { ManageViewsDialog } from "./ManageViewsDialog";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { ColumnForm } from "@/components/forms/column-form";
import { ParseGongTranscriptDialog } from "@/components/features/opportunities/parse-gong-transcript-dialog";
import { Opportunity, OpportunityStage, getDefaultConfidenceLevel, getDefaultForecastCategory } from "@/types/opportunity";
import { SerializedKanbanView, isBuiltInView } from "@/types/view";
import { createOpportunity, updateOpportunity } from "@/lib/api/opportunities";
import { OpportunityCreateInput } from "@/lib/validations/opportunity";
import { createColumn } from "@/lib/api/columns";
import { ColumnCreateInput } from "@/lib/validations/column";
import { createView, activateView, deactivateAllViews } from "@/lib/api/views";
import { ViewType } from "@prisma/client";
import { formatDateShort } from "@/lib/format";
import { getQuarterFromDate } from "@/lib/utils/quarter";
import { countHiddenOpportunities } from "@/lib/utils/quarterly-view";

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
  const [showAllQuarters, setShowAllQuarters] = useState(false);

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

  // Check localStorage for selected built-in view preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedBuiltInViewId = localStorage.getItem("selected-built-in-view");
      if (savedBuiltInViewId && isBuiltInView(savedBuiltInViewId)) {
        // If a built-in view was previously selected and we're not already on it,
        // and there's no active custom view, switch to it
        const hasActiveCustomView = views.some(v => !isBuiltInView(v.id) && v.isActive);
        if (!hasActiveCustomView && activeView.id !== savedBuiltInViewId) {
          const savedView = views.find(v => v.id === savedBuiltInViewId);
          if (savedView) {
            setActiveView(savedView);
          }
        }
      }
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show welcome dialog for new users (client-side only to avoid hydration mismatch)
  // This should only run once on mount
  useEffect(() => {
    // Only access localStorage in useEffect to avoid SSR hydration issues
    if (typeof window !== 'undefined') {
      const hasSeenWelcome = localStorage.getItem("kanban-welcome-seen");
      if (isNewUser && !hasSeenWelcome) {
        setIsWelcomeDialogOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount, isNewUser is stable from server

  // Load and persist showAllQuarters preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("kanban-show-all-quarters");
      if (saved !== null) {
        setShowAllQuarters(saved === "true");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("kanban-show-all-quarters", String(showAllQuarters));
    }
  }, [showAllQuarters]);

  // Get display columns based on active view
  const displayColumns = useMemo(() => {
    // For quarterly view, regenerate columns based on showAllQuarters setting
    if (activeView.viewType === "quarterly") {
      // Use dynamic import in useMemo is not ideal, but we need this for quarterly regeneration
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { generateQuarterlyColumns } = require("@/lib/utils/quarterly-view");
      return generateQuarterlyColumns(localOpportunities, fiscalYearStartMonth, showAllQuarters);
    }
    return activeView.columns;
  }, [activeView, showAllQuarters, localOpportunities, fiscalYearStartMonth]);

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

  // Check if current view is quarterly
  const isQuarterlyView = activeView.viewType === "quarterly";

  // Count hidden opportunities (only for quarterly view when rolling window is active)
  const hiddenOpportunitiesCount = useMemo(() => {
    if (!isQuarterlyView || showAllQuarters) return 0;
    return countHiddenOpportunities(localOpportunities, displayColumns, fiscalYearStartMonth);
  }, [isQuarterlyView, showAllQuarters, localOpportunities, displayColumns, fiscalYearStartMonth]);

  // Handle view selection (optimistic update)
  const handleSelectView = async (viewId: string) => {
    // Find the view
    const newView = views.find(v => v.id === viewId);
    if (!newView) return;

    // Optimistic update
    setActiveView(newView);

    try {
      if (isBuiltInView(viewId)) {
        // For built-in views, deactivate all custom views
        // This ensures that on refresh, no custom view will be active,
        // and the server-side logic will fall through to selecting the built-in view
        await deactivateAllViews();

        // Store the selected built-in view ID in localStorage
        // so it persists across page refreshes
        if (typeof window !== 'undefined') {
          localStorage.setItem("selected-built-in-view", viewId);
        }
      } else {
        // For custom views, activate this specific view (which deactivates others)
        // and clear the built-in view preference
        if (typeof window !== 'undefined') {
          localStorage.removeItem("selected-built-in-view");
        }
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
      await createView({
        name: "New Custom View",
        viewType: "custom",
        isDefault: false,
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
    // Optimistic update: update local state immediately
    const previousOpportunities = [...localOpportunities];

    // Determine if this is a quarterly view update (has closeDate) or custom view update (has columnId)
    const isQuarterlyUpdate = newCloseDate !== undefined;

    if (isQuarterlyUpdate) {
      // Quarterly mode: Update closeDate and recalculate quarter
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
        // Update on server in background
        await updateOpportunity(opportunityId, { closeDate: newCloseDate || undefined });

        // Show toast notification
        if (newCloseDate) {
          toast.success(`Close date updated to ${formatDateShort(newCloseDate)}`);
        } else {
          toast.success("Close date cleared");
        }

        // Refresh in background to sync with server (non-blocking)
        router.refresh();
      } catch (error) {
        // Rollback on error
        setLocalOpportunities(previousOpportunities);
        toast.error(error instanceof Error ? error.message : "Failed to update close date");
        throw error;
      }
    } else {
      // Custom mode: Update columnId
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
    }
  };

  const handleCreateColumn = async (data: ColumnCreateInput) => {
    try {
      const maxOrder = displayColumns.length > 0 ? Math.max(...displayColumns.map((c: { order: number }) => c.order)) : -1;
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

          {/* Quarterly View: Show All Quarters Toggle */}
          {isQuarterlyView && (
            <Button
              size="sm"
              variant={showAllQuarters ? "default" : "outline"}
              onClick={() => setShowAllQuarters(!showAllQuarters)}
            >
              {showAllQuarters ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
              {showAllQuarters ? "Showing All" : "Rolling Window"}
              {!showAllQuarters && hiddenOpportunitiesCount > 0 && (
                <span className="ml-1 text-xs opacity-70">
                  ({hiddenOpportunitiesCount} hidden)
                </span>
              )}
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
