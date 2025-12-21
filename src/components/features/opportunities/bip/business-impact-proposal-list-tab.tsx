"use client";

/**
 * BusinessImpactProposalListTab Component
 *
 * Lists BIP documents for an opportunity with generation support.
 * Similar to MutualActionPlanTab but shows a list of documents
 * rather than a single inline view.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Document } from "@/types/document";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DocumentCard } from "@/components/features/documents/DocumentCard";
import { Sparkles, FileText, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface BusinessImpactProposalListTabProps {
  opportunityId: string;
  opportunityName: string;
}

export function BusinessImpactProposalListTab({
  opportunityId,
  opportunityName,
}: BusinessImpactProposalListTabProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showContextInput, setShowContextInput] = useState(false);
  const [additionalContext, setAdditionalContext] = useState("");
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  // Fetch BIP documents
  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/documents?category=business_impact_proposal`
      );
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);

        // Check for generating documents
        const generating = (data.documents || [])
          .filter(
            (d: Document) =>
              d.generationStatus === "generating" ||
              d.generationStatus === "pending"
          )
          .map((d: Document) => d.id);
        setPollingIds(new Set(generating));
      }
    } catch (error) {
      console.error("Failed to fetch BIP documents:", error);
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll for generation status
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

            if (
              doc.generationStatus === "completed" ||
              doc.generationStatus === "failed"
            ) {
              setDocuments((prev) =>
                prev.map((d) => (d.id === id ? doc : d))
              );
              setPollingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });

              if (doc.generationStatus === "completed") {
                toast.success("Business Impact Proposal generated!");
              } else {
                toast.error("BIP generation failed");
              }
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingIds, opportunityId]);

  // Generate new BIP
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/documents/bip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            additionalContext: additionalContext.trim() || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate BIP");
      }

      // Add new document to list and start polling
      setDocuments((prev) => [data.document, ...prev]);
      setPollingIds((prev) => new Set([...prev, data.document.id]));
      setShowContextInput(false);
      setAdditionalContext("");
      toast.success("BIP generation started!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Generation failed"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete document
  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this BIP?")) return;

    try {
      const response = await fetch(
        `/api/v1/opportunities/${opportunityId}/documents/${docId}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("BIP deleted");
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (error) {
      toast.error("Failed to delete BIP");
    }
  };

  // Open document
  const handleOpenDocument = (doc: Document) => {
    router.push(`/opportunities/${opportunityId}/documents/${doc.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Generate Button and Context Input */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || pollingIds.size > 0}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {isGenerating ? "Generating..." : "Generate New BIP"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowContextInput(!showContextInput)}
        >
          {showContextInput ? (
            <>
              <X className="h-4 w-4 mr-1" />
              Hide context
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Add context
            </>
          )}
        </Button>
      </div>

      {/* Additional Context Input */}
      {showContextInput && (
        <div className="space-y-2 p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
          <Label htmlFor="bip-context" className="text-sm font-medium">
            Additional Context
          </Label>
          <Textarea
            id="bip-context"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Add any additional context for this BIP generation. For example: recent conversations, competitive intel, budget info, specific pain points to emphasize, or timing considerations..."
            rows={4}
            maxLength={5000}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {additionalContext.length}/5000 characters
          </p>
        </div>
      )}

      {/* Document List */}
      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">No Business Impact Proposals</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate a BIP using AI to create a compelling proposal based on
              your opportunity data and call insights.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              isGenerating={pollingIds.has(doc.id)}
              onClick={() => handleOpenDocument(doc)}
              onDelete={() => handleDelete(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
