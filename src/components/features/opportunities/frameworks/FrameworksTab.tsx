"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { GeneratedContent, FRAMEWORK_CATEGORY_LABELS } from "@/types/framework";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FrameworkSelectionDialog } from "./FrameworkSelectionDialog";
import { GeneratedContentViewer } from "./GeneratedContentViewer";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import {
  Sparkles,
  FileText,
  Clock,
  RefreshCw,
  History,
  Trash2,
  Loader2,
  Plus,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { toast } from "sonner";

interface FrameworksTabProps {
  opportunityId: string;
  opportunityName: string;
  hasAccountResearch?: boolean;
  hasConsolidatedInsights?: boolean;
}

export const FrameworksTab = ({
  opportunityId,
  opportunityName,
  hasAccountResearch = false,
  hasConsolidatedInsights = false,
}: FrameworksTabProps) => {
  const [generatedContents, setGeneratedContents] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedContent, setSelectedContent] = useState<GeneratedContent | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  // Fetch generated content for this opportunity
  const fetchGeneratedContent = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/generated-content`
      );
      if (response.ok) {
        const data = await response.json();
        setGeneratedContents(data.generatedContents || []);

        // Check for any generating content to poll
        const generating = (data.generatedContents || [])
          .filter((c: GeneratedContent) => c.generationStatus === "generating" || c.generationStatus === "pending")
          .map((c: GeneratedContent) => c.id);
        setPollingIds(new Set(generating));
      }
    } catch (error) {
      console.error("Failed to fetch generated content:", error);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    fetchGeneratedContent();
  }, [fetchGeneratedContent]);

  // Poll for generating content status
  useEffect(() => {
    if (pollingIds.size === 0) return;

    const interval = setInterval(async () => {
      for (const id of pollingIds) {
        try {
          const response = await fetch(
            `/api/v1/opportunities/${opportunityId}/generated-content/${id}`
          );
          if (response.ok) {
            const data = await response.json();
            const content = data.generatedContent;

            if (content.generationStatus === "completed" || content.generationStatus === "failed") {
              // Update the content in state
              setGeneratedContents((prev) =>
                prev.map((c) => (c.id === id ? content : c))
              );
              // Remove from polling
              setPollingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              // Also update selected content if viewing
              if (selectedContent?.id === id) {
                setSelectedContent(content);
              }
              // Show toast
              if (content.generationStatus === "completed") {
                toast.success("Content generated successfully!");
              } else {
                toast.error("Content generation failed");
              }
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [pollingIds, opportunityId, selectedContent]);

  const handleGenerate = (content: GeneratedContent) => {
    // Add to list and start polling
    setGeneratedContents((prev) => [content, ...prev]);
    setPollingIds((prev) => new Set(prev).add(content.id));
    // Select the new content to show it
    setSelectedContent(content);
  };

  const handleUpdateContent = async (
    contentId: string,
    updates: { title?: string; content?: string }
  ) => {
    const response = await fetch(
      `/api/v1/opportunities/${opportunityId}/generated-content/${contentId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to update content");
    }

    const data = await response.json();
    setGeneratedContents((prev) =>
      prev.map((c) => (c.id === contentId ? data.generatedContent : c))
    );
    if (selectedContent?.id === contentId) {
      setSelectedContent(data.generatedContent);
    }
  };

  const handleRegenerate = async (content: GeneratedContent) => {
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/generated-content/${content.id}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contextSelection: content.contextSnapshot,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to start regeneration");
      }

      const data = await response.json();
      toast.success("Regeneration started!");

      // Add new version to list and poll
      setGeneratedContents((prev) => [data.generatedContent, ...prev]);
      setPollingIds((prev) => new Set(prev).add(data.generatedContent.id));
      setSelectedContent(data.generatedContent);
    } catch (error) {
      toast.error("Failed to regenerate content");
    }
  };

  const handleDelete = async (contentId: string) => {
    if (!confirm("Are you sure you want to delete this content?")) return;

    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/generated-content/${contentId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete content");
      }

      toast.success("Content deleted");
      setGeneratedContents((prev) => prev.filter((c) => c.id !== contentId));
      if (selectedContent?.id === contentId) {
        setSelectedContent(null);
      }
    } catch (error) {
      toast.error("Failed to delete content");
    }
  };

  const handleRestoreVersion = () => {
    // Refresh the content list after restore
    fetchGeneratedContent();
    setSelectedContent(null);
    setShowHistory(false);
  };

  // Show selected content viewer
  if (selectedContent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedContent(null)}
          >
            &larr; Back to list
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
            >
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRegenerate(selectedContent)}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Regenerate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(selectedContent.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <GeneratedContentViewer
          content={selectedContent}
          isGenerating={pollingIds.has(selectedContent.id)}
          onUpdate={(updates) => handleUpdateContent(selectedContent.id, updates)}
          onRegenerate={() => handleRegenerate(selectedContent)}
          onViewHistory={() => setShowHistory(true)}
        />

        <VersionHistoryPanel
          open={showHistory}
          onOpenChange={setShowHistory}
          opportunityId={opportunityId}
          contentId={selectedContent.id}
          currentVersion={selectedContent.version}
          onRestore={handleRestoreVersion}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with generate button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Generated Content</h3>
          <p className="text-sm text-muted-foreground">
            Create AI-powered sales documents for this opportunity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/frameworks/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Framework
            </Link>
          </Button>
          <Button onClick={() => setShowDialog(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Content
          </Button>
        </div>
      </div>

      {/* Content list */}
      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : generatedContents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">No content generated yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Use AI to generate business cases, proposals, follow-up emails, and more
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Your First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {generatedContents.map((content) => (
            <Card
              key={content.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedContent(content)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {content.generationStatus === "generating" || content.generationStatus === "pending" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h4 className="font-medium text-sm truncate">
                        {content.title}
                      </h4>
                      {content.version > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          v{content.version}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {content.framework && (
                        <Badge variant="outline" className="text-xs">
                          {FRAMEWORK_CATEGORY_LABELS[content.framework.category]}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {content.generatedAt
                          ? formatDateShort(content.generatedAt)
                          : formatDateShort(content.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRegenerate(content)}
                      disabled={content.generationStatus === "generating"}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(content.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Framework selection dialog */}
      <FrameworkSelectionDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        opportunityId={opportunityId}
        opportunityName={opportunityName}
        hasAccountResearch={hasAccountResearch}
        hasConsolidatedInsights={hasConsolidatedInsights}
        onGenerate={handleGenerate}
      />
    </div>
  );
};
