"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Document, BRIEF_CATEGORY_LABELS } from "@/types/document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { MAPDocumentEditor } from "@/components/features/documents/editors/MAPDocumentEditor";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  History,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

interface DocumentEditorClientProps {
  document: Document & {
    versions: Array<{
      id: string;
      version: number;
      createdAt: string;
      generationStatus: string | null;
      createdBy?: { id: string; name: string | null };
    }>;
  };
  currentUserId: string;
}

export const DocumentEditorClient = ({
  document: initialDocument,
  currentUserId,
}: DocumentEditorClientProps) => {
  const router = useRouter();
  const [document, setDocument] = useState(initialDocument);
  const [title, setTitle] = useState(initialDocument.title);
  const [content, setContent] = useState(initialDocument.content || "");
  const [structuredData, setStructuredData] = useState(initialDocument.structuredData);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isPolling, setIsPolling] = useState(
    initialDocument.generationStatus === "pending" ||
    initialDocument.generationStatus === "generating"
  );

  // Debounced values for auto-save
  const debouncedTitle = useDebounce(title, 1500);
  const debouncedContent = useDebounce(content, 1500);

  // Poll for generation status
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/v1/opportunities/${document.opportunityId}/documents/${document.id}`
        );

        // Stop polling on authentication errors
        if (response.status === 401) {
          setIsPolling(false);
          toast.error("Session expired. Please refresh the page.");
          return;
        }

        if (response.ok) {
          const data = await response.json();
          const updatedDoc = data.document;

          if (updatedDoc.generationStatus === "completed" || updatedDoc.generationStatus === "failed") {
            setIsPolling(false);
            setDocument(updatedDoc);
            setContent(updatedDoc.content || "");
            setStructuredData(updatedDoc.structuredData);

            if (updatedDoc.generationStatus === "completed") {
              toast.success("Document generated successfully!");
            } else {
              toast.error("Document generation failed");
            }
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPolling, document.id, document.opportunityId]);

  // Auto-save on debounced changes
  useEffect(() => {
    const hasChanges =
      debouncedTitle !== document.title ||
      debouncedContent !== (document.content || "");

    if (hasChanges && !isPolling) {
      saveDocument({ title: debouncedTitle, content: debouncedContent });
    }
  }, [debouncedTitle, debouncedContent]);

  const saveDocument = async (updates: { title?: string; content?: string; structuredData?: unknown }) => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/v1/opportunities/${document.opportunityId}/documents/${document.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      const data = await response.json();
      setDocument((prev) => ({ ...prev, ...data.document }));
      setLastSaved(new Date());
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save document");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStructuredDataChange = useCallback(async (newData: unknown) => {
    setStructuredData(newData as typeof structuredData);
    await saveDocument({ structuredData: newData });
  }, [document.id, document.opportunityId]);

  const handleCopyToClipboard = async () => {
    try {
      if (document.category === "mutual_action_plan") {
        // For MAPs, copy as formatted text
        const items = (structuredData?.actionItems || []) as Array<{
          description: string;
          owner: string;
          targetDate?: string | null;
          status: string;
        }>;
        const text = items.map((item) =>
          `- ${item.description} (${item.owner}) - Due: ${item.targetDate || "TBD"} - Status: ${item.status}`
        ).join("\n");
        await navigator.clipboard.writeText(text);
      } else {
        await navigator.clipboard.writeText(content);
      }
      toast.success("Copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleRegenerate = async () => {
    try {
      const response = await fetch(
        `/api/v1/opportunities/${document.opportunityId}/documents/${document.id}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contextSelection: document.contextSnapshot || {},
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to regenerate");
      }

      const data = await response.json();
      toast.success("Regeneration started!");

      // Navigate to the new version
      router.push(`/opportunities/${document.opportunityId}/documents/${data.document.id}`);
    } catch (error) {
      toast.error("Failed to regenerate document");
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    try {
      const response = await fetch(
        `/api/v1/opportunities/${document.opportunityId}/documents/${document.id}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to restore");
      }

      const data = await response.json();
      toast.success("Version restored!");
      setShowHistory(false);

      // Navigate to the restored version
      router.push(`/opportunities/${document.opportunityId}/documents/${data.document.id}`);
    } catch (error) {
      toast.error("Failed to restore version");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this document? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/opportunities/${document.opportunityId}/documents/${document.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete");
      }

      toast.success("Document deleted");
      router.push(`/opportunities/${document.opportunityId}?tab=documents`);
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  const getSaveStatus = () => {
    if (isSaving) {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </span>
      );
    }
    if (lastSaved) {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3 w-3 text-green-500" />
          Saved {formatDateShort(lastSaved)}
        </span>
      );
    }
    return null;
  };

  // Can regenerate if document has a brief or is a MAP
  const canRegenerate =
    document.briefId ||
    document.category === "mutual_action_plan";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/opportunities/${document.opportunityId}?tab=documents`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                {document.opportunity?.name || "Back"}
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {BRIEF_CATEGORY_LABELS[document.category]}
              </Badge>
              {document.version > 1 && (
                <Badge variant="secondary">v{document.version}</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getSaveStatus()}

            <Button variant="ghost" size="sm" onClick={handleCopyToClipboard}>
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>

            {document.versions.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
            )}

            {canRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={isPolling}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isPolling ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container max-w-4xl py-6 px-4">
        {/* Title input */}
        <div className="mb-6">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
            placeholder="Document title..."
          />
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            {document.brief && (
              <span>Brief: {document.brief.name}</span>
            )}
            {document.lastEditedBy && document.lastEditedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last edited by {document.lastEditedBy.name || "Unknown"} on{" "}
                {formatDateShort(document.lastEditedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Editor based on category - MAP uses table editor, all others use RTF */}
        {isPolling ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generating content...</span>
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : document.category === "mutual_action_plan" ? (
          <MAPDocumentEditor
            structuredData={structuredData}
            onChange={handleStructuredDataChange}
          />
        ) : (
          <div className="min-h-[500px] border rounded-lg">
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Start writing..."
              className="min-h-[500px]"
              enableAI={true}
              opportunityId={document.opportunityId}
            />
          </div>
        )}
      </div>

      {/* Version history sheet */}
      <Sheet open={showHistory} onOpenChange={setShowHistory}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
            <SheetDescription>
              View and restore previous versions of this document
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {document.versions.map((version) => (
              <div
                key={version.id}
                className={`p-3 rounded-lg border ${
                  version.id === document.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Version {version.version}</div>
                    <div className="text-sm text-muted-foreground">
                      {version.createdBy?.name || "Unknown"} -{" "}
                      {formatDateShort(version.createdAt)}
                    </div>
                  </div>
                  {version.id !== document.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreVersion(version.id)}
                    >
                      Restore
                    </Button>
                  )}
                  {version.id === document.id && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
