"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Document, BRIEF_CATEGORY_LABELS, BriefCategory } from "@/types/document";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentCard } from "./DocumentCard";
import {
  FileStack,
  Plus,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MutualActionPlanTab } from "@/components/features/opportunities/map";
import { BusinessImpactProposalListTab } from "@/components/features/opportunities/bip";
import { useDebounce } from "@/hooks/useDebounce";

interface DocumentsTabProps {
  opportunityId: string;
  opportunityName: string;
  hasAccountResearch?: boolean;
  hasConsolidatedInsights?: boolean;
}

type FilterType = BriefCategory | "all";

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
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  // Navigate to full-page create document workflow
  const handleNavigateToCreate = () => {
    router.push(`/opportunities/${opportunityId}/generate`);
  };

  // Fetch documents for this opportunity
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL(`/api/v1/opportunities/${opportunityId}/documents`, window.location.origin);
      if (filter !== "all") {
        url.searchParams.set("category", filter);
      }
      if (debouncedSearch) {
        url.searchParams.set("search", debouncedSearch);
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
  }, [opportunityId, filter, debouncedSearch]);

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

  // Calculate counts for each category
  const counts: Record<string, number> = {
    all: documents.length,
  };

  // Count documents by category
  for (const doc of documents) {
    counts[doc.category] = (counts[doc.category] || 0) + 1;
  }

  // Documents are already filtered server-side, no client-side filtering needed
  const hasActiveFilters = filter !== "all" || debouncedSearch !== "";

  return (
    <div className="space-y-4">
      {/* Header with actions - hide actions when showing MAP view */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Documents</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage sales documents for this opportunity
          </p>
        </div>
        {filter !== "mutual_action_plan" && filter !== "business_impact_proposal" && (
          <Button onClick={handleNavigateToCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Document
          </Button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: "all", label: "All" },
          { value: "mutual_action_plan", label: "MAPs" },
          { value: "pricing_proposal", label: "Pricing Proposal" },
          { value: "executive_summary", label: "Exec Summary" },
          { value: "email", label: "Email" },
          { value: "notes", label: "Notes" },
          { value: "general", label: "General" },
          { value: "business_impact_proposal", label: "BIPs" },
        ].map((item) => (
          <button
            key={item.value}
            onClick={() => setFilter(item.value as FilterType)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-full border transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              filter === item.value
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-foreground border-border hover:bg-muted"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Search filter */}
      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search documents..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={() => setSearchInput("")}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      </div>

      {/* Document list - Show inline views for MAP and BIP tabs */}
      {filter === "mutual_action_plan" ? (
        <MutualActionPlanTab opportunityId={opportunityId} />
      ) : filter === "business_impact_proposal" ? (
        <BusinessImpactProposalListTab
          opportunityId={opportunityId}
          opportunityName={opportunityName}
        />
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileStack className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">
              {hasActiveFilters ? "No matching documents" : "No documents yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hasActiveFilters
                ? "Try adjusting your filters or search term"
                : "Create business cases, proposals, MAPs, and more for this opportunity"}
            </p>
            {!hasActiveFilters && (
              <Button onClick={handleNavigateToCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Document
              </Button>
            )}
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
              onDelete={() => handleDeleteDocument(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
