"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Document, DOCUMENT_TYPE_LABELS } from "@/types/document";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentCard } from "./DocumentCard";
import { CreateDocumentDialog } from "./CreateDocumentDialog";
import { FrameworkSelectionDialog } from "../opportunities/frameworks/FrameworkSelectionDialog";
import {
  FileStack,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface DocumentsTabProps {
  opportunityId: string;
  opportunityName: string;
  hasAccountResearch?: boolean;
  hasConsolidatedInsights?: boolean;
}

type FilterType = "all" | "mutual_action_plan" | "rich_text" | "framework_generated";

export const DocumentsTab = ({
  opportunityId,
  opportunityName,
  hasAccountResearch = false,
  hasConsolidatedInsights = false,
}: DocumentsTabProps) => {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  // Fetch documents for this opportunity
  const fetchDocuments = useCallback(async () => {
    try {
      const url = new URL(`/api/v1/opportunities/${opportunityId}/documents`, window.location.origin);
      if (filter !== "all") {
        url.searchParams.set("documentType", filter);
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);

        // Check for any generating documents to poll
        const generating = (data.documents || [])
          .filter((d: Document) => d.generationStatus === "generating" || d.generationStatus === "pending")
          .map((d: Document) => d.id);
        setPollingIds(new Set(generating));
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, [opportunityId, filter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll for generating document status
  useEffect(() => {
    if (pollingIds.size === 0) return;

    const interval = setInterval(async () => {
      for (const id of pollingIds) {
        try {
          const response = await fetch(
            `/api/v1/opportunities/${opportunityId}/documents/${id}`
          );
          if (response.ok) {
            const data = await response.json();
            const doc = data.document;

            if (doc.generationStatus === "completed" || doc.generationStatus === "failed") {
              // Update the document in state
              setDocuments((prev) =>
                prev.map((d) => (d.id === id ? doc : d))
              );
              // Remove from polling
              setPollingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              // Show toast
              if (doc.generationStatus === "completed") {
                toast.success("Document generated successfully!");
              } else {
                toast.error("Document generation failed");
              }
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [pollingIds, opportunityId]);

  const handleCreateDocument = async (doc: Document) => {
    // Add to list and possibly start polling
    setDocuments((prev) => [doc, ...prev]);
    if (doc.generationStatus === "pending" || doc.generationStatus === "generating") {
      setPollingIds((prev) => new Set(prev).add(doc.id));
    }
    // Navigate to the document editor
    router.push(`/opportunities/${opportunityId}/documents/${doc.id}`);
  };

  const handleGenerateDocument = async (content: { id: string; title: string; generationStatus: string }) => {
    // The FrameworkSelectionDialog returns GeneratedContent, but we created a Document
    // We need to fetch the actual document
    const response = await fetch(`/api/v1/opportunities/${opportunityId}/documents/${content.id}`);
    if (response.ok) {
      const data = await response.json();
      handleCreateDocument(data.document);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/documents/${docId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      toast.success("Document deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  const handleOpenDocument = (doc: Document) => {
    router.push(`/opportunities/${opportunityId}/documents/${doc.id}`);
  };

  // Filter counts
  const counts = {
    all: documents.length,
    mutual_action_plan: documents.filter((d) => d.documentType === "mutual_action_plan").length,
    rich_text: documents.filter((d) => d.documentType === "rich_text").length,
    framework_generated: documents.filter((d) => d.documentType === "framework_generated").length,
  };

  const filteredDocuments = filter === "all"
    ? documents
    : documents.filter((d) => d.documentType === filter);

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Documents</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage sales documents for this opportunity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Document
          </Button>
          <Button onClick={() => setShowGenerateDialog(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
        <TabsList>
          <TabsTrigger value="all">
            All ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="mutual_action_plan">
            MAPs ({counts.mutual_action_plan})
          </TabsTrigger>
          <TabsTrigger value="rich_text">
            Documents ({counts.rich_text})
          </TabsTrigger>
          <TabsTrigger value="framework_generated">
            AI Generated ({counts.framework_generated})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Document list */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileStack className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">
              {filter === "all" ? "No documents yet" : `No ${DOCUMENT_TYPE_LABELS[filter as keyof typeof DOCUMENT_TYPE_LABELS]}s yet`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create business cases, proposals, MAPs, and more for this opportunity
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Document
              </Button>
              <Button onClick={() => setShowGenerateDialog(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              isGenerating={pollingIds.has(doc.id)}
              onClick={() => handleOpenDocument(doc)}
              onDelete={() => handleDeleteDocument(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Create document dialog */}
      <CreateDocumentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        opportunityId={opportunityId}
        onCreate={handleCreateDocument}
      />

      {/* Framework selection dialog for AI generation */}
      <FrameworkSelectionDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        opportunityId={opportunityId}
        opportunityName={opportunityName}
        hasAccountResearch={hasAccountResearch}
        hasConsolidatedInsights={hasConsolidatedInsights}
        onGenerate={handleGenerateDocument}
      />
    </div>
  );
};
