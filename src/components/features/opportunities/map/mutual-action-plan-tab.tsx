"use client";

/**
 * MutualActionPlanTab Component
 *
 * Main container for the MAP tab on opportunity detail page.
 * Handles:
 * - Loading and displaying existing MAP
 * - Empty states (no MAP, no meetings)
 * - Generation trigger
 * - Polling for generation status
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileSpreadsheet,
  Plus,
  RefreshCw,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import type {
  MutualActionPlan,
  MAPActionItem,
} from "@/types/mutual-action-plan";
import { MAPHeader } from "./map-header";
import { MAPTable } from "./map-table";
import { MAPGenerationDialog } from "./map-generation-dialog";

// ============================================================================
// Types
// ============================================================================

interface MutualActionPlanTabProps {
  opportunityId: string;
}

interface MAPResponse {
  mutualActionPlan: MutualActionPlan | null;
  meetingCount: number;
  canGenerate: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function MutualActionPlanTab({ opportunityId }: MutualActionPlanTabProps) {
  const [map, setMap] = useState<MutualActionPlan | null>(null);
  const [meetingCount, setMeetingCount] = useState(0);
  const [canGenerate, setCanGenerate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerationDialog, setShowGenerationDialog] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch MAP data
  const fetchMAP = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/opportunities/${opportunityId}/mutual-action-plan`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch MAP");
      }
      const data: MAPResponse = await res.json();
      setMap(data.mutualActionPlan);
      setMeetingCount(data.meetingCount);
      setCanGenerate(data.canGenerate);

      // Check if we need to poll for generation status
      if (
        data.mutualActionPlan?.generationStatus === "pending" ||
        data.mutualActionPlan?.generationStatus === "generating"
      ) {
        setIsGenerating(true);
      } else {
        setIsGenerating(false);
        // Clear poll interval if generation is complete
        if (pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch MAP:", error);
      toast.error("Failed to load Mutual Action Plan");
    } finally {
      setIsLoading(false);
    }
  }, [opportunityId, pollInterval]);

  // Initial fetch
  useEffect(() => {
    fetchMAP();
  }, [fetchMAP]);

  // Poll for generation status when generating
  useEffect(() => {
    if (isGenerating && !pollInterval) {
      const interval = setInterval(fetchMAP, 3000); // Poll every 3 seconds
      setPollInterval(interval);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isGenerating, pollInterval, fetchMAP]);

  // Handle generation trigger
  const handleGenerate = async (templateContentId?: string) => {
    setShowGenerationDialog(false);
    setIsGenerating(true);

    try {
      const res = await fetch(
        `/api/v1/opportunities/${opportunityId}/mutual-action-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateContentId }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate MAP");
      }

      toast.success("MAP generation started!");
      // Start polling
      const interval = setInterval(fetchMAP, 3000);
      setPollInterval(interval);
    } catch (error) {
      console.error("Failed to generate MAP:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate MAP"
      );
      setIsGenerating(false);
    }
  };

  // Handle action item update
  const handleUpdateActionItem = async (
    itemId: string,
    updates: Partial<MAPActionItem>
  ) => {
    try {
      const res = await fetch(
        `/api/v1/opportunities/${opportunityId}/mutual-action-plan/action-items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update action item");
      }

      const data = await res.json();
      setMap(data.mutualActionPlan);
    } catch (error) {
      console.error("Failed to update action item:", error);
      toast.error("Failed to update action item");
    }
  };

  // Handle action item delete
  const handleDeleteActionItem = async (itemId: string) => {
    try {
      const res = await fetch(
        `/api/v1/opportunities/${opportunityId}/mutual-action-plan/action-items/${itemId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        throw new Error("Failed to delete action item");
      }

      const data = await res.json();
      setMap(data.mutualActionPlan);
      toast.success("Action item deleted");
    } catch (error) {
      console.error("Failed to delete action item:", error);
      toast.error("Failed to delete action item");
    }
  };

  // Handle add action item
  const handleAddActionItem = async (item: Omit<MAPActionItem, "id" | "order">) => {
    try {
      const res = await fetch(
        `/api/v1/opportunities/${opportunityId}/mutual-action-plan/action-items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to add action item");
      }

      const data = await res.json();
      setMap(data.mutualActionPlan);
      toast.success("Action item added");
    } catch (error) {
      console.error("Failed to add action item:", error);
      toast.error("Failed to add action item");
    }
  };

  // Handle title update
  const handleUpdateTitle = async (title: string) => {
    try {
      const res = await fetch(
        `/api/v1/opportunities/${opportunityId}/mutual-action-plan`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update title");
      }

      const data = await res.json();
      setMap(data.mutualActionPlan);
    } catch (error) {
      console.error("Failed to update title:", error);
      toast.error("Failed to update title");
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // No meetings state
  if (!canGenerate) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Meetings Yet</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            MAP generation requires at least 1 parsed meeting. Add a Gong call
            or Granola note to get started.
          </p>
          <p className="text-sm text-muted-foreground">
            Current meeting count: {meetingCount}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Generating state
  if (isGenerating) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="h-12 w-12 text-primary animate-spin mb-4" />
          <h3 className="text-lg font-semibold mb-2">Generating MAP...</h3>
          <p className="text-muted-foreground text-center max-w-md">
            AI is analyzing your meetings and creating a Mutual Action Plan.
            This may take up to a minute.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Generation failed state
  if (map?.generationStatus === "failed") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Generation Failed</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            {map.generationError || "An error occurred during generation."}
          </p>
          <Button onClick={() => setShowGenerationDialog(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No MAP yet - show generate button
  if (!map || map.generationStatus === "pending") {
    return (
      <>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Mutual Action Plan</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Generate a MAP to create a collaborative project plan with your
              customer. The AI will use your meeting history to populate
              milestones and action items.
            </p>
            <Button onClick={() => setShowGenerationDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Generate MAP
            </Button>
          </CardContent>
        </Card>

        <MAPGenerationDialog
          open={showGenerationDialog}
          onOpenChange={setShowGenerationDialog}
          meetingCount={meetingCount}
          onGenerate={handleGenerate}
        />
      </>
    );
  }

  // MAP exists - show full UI
  return (
    <>
      <div className="space-y-4">
        <MAPHeader
          title={map.title || "Mutual Action Plan"}
          generatedAt={map.generatedAt}
          lastEditedAt={map.lastEditedAt}
          lastEditedBy={map.lastEditedBy}
          templateName={map.templateContent?.title}
          onTitleChange={handleUpdateTitle}
          onRegenerate={() => setShowGenerationDialog(true)}
          actionItems={map.actionItems as MAPActionItem[]}
        />

        <MAPTable
          actionItems={map.actionItems as MAPActionItem[]}
          onUpdateItem={handleUpdateActionItem}
          onDeleteItem={handleDeleteActionItem}
          onAddItem={handleAddActionItem}
        />
      </div>

      <MAPGenerationDialog
        open={showGenerationDialog}
        onOpenChange={setShowGenerationDialog}
        meetingCount={meetingCount}
        onGenerate={handleGenerate}
        isRegenerate
      />
    </>
  );
}
