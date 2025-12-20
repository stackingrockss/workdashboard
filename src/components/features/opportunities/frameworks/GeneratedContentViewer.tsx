"use client";

import { useState } from "react";
import { GeneratedContent } from "@/types/framework";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Copy,
  Edit2,
  Save,
  X,
  RefreshCw,
  History,
  Loader2,
  Check,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

interface GeneratedContentViewerProps {
  content: GeneratedContent;
  isGenerating?: boolean;
  onUpdate?: (updates: { title?: string; content?: string }) => Promise<void>;
  onRegenerate?: () => void;
  onViewHistory?: () => void;
}

export const GeneratedContentViewer = ({
  content,
  isGenerating = false,
  onUpdate,
  onRegenerate,
  onViewHistory,
}: GeneratedContentViewerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content.content);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    if (!onUpdate) return;

    setIsSaving(true);
    try {
      await onUpdate({ content: editedContent });
      setIsEditing(false);
      toast.success("Content saved");
    } catch (error) {
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(content.content);
    setIsEditing(false);
  };

  const handleCopy = async (format: "plain" | "html") => {
    try {
      if (format === "plain") {
        await navigator.clipboard.writeText(content.content);
      } else {
        // Create a temporary element to get HTML
        const temp = document.createElement("div");
        temp.innerHTML = content.content;
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([content.content], { type: "text/html" }),
            "text/plain": new Blob([content.content], { type: "text/plain" }),
          }),
        ]);
      }
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback to plain text copy
      await navigator.clipboard.writeText(content.content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show loading state while generating
  if (isGenerating || content.generationStatus === "generating") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <CardTitle className="text-base">Generating content...</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </CardContent>
      </Card>
    );
  }

  // Show error state if failed
  if (content.generationStatus === "failed") {
    return (
      <Card className="border-destructive">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-destructive">
              Generation Failed
            </CardTitle>
            {onRegenerate && (
              <Button variant="outline" size="sm" onClick={onRegenerate}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {content.generationError ||
              "An error occurred during generation. Please try again."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{content.title}</CardTitle>
            {content.version > 1 && (
              <Badge variant="secondary" className="text-xs">
                v{content.version}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy("plain")}
                  disabled={!content.content}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                {onViewHistory && (
                  <Button variant="ghost" size="sm" onClick={onViewHistory}>
                    <History className="h-4 w-4" />
                  </Button>
                )}
                {onRegenerate && (
                  <Button variant="ghost" size="sm" onClick={onRegenerate}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {onUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
        {content.generatedAt && (
          <p className="text-xs text-muted-foreground">
            Generated {formatDateShort(content.generatedAt)}
            {content.createdBy?.name && ` by ${content.createdBy.name}`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            rows={20}
            className="font-mono text-sm resize-none"
          />
        ) : (
          <div
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "prose-headings:font-semibold prose-headings:text-foreground",
              "prose-p:text-muted-foreground prose-p:leading-relaxed",
              "prose-li:text-muted-foreground",
              "prose-strong:text-foreground",
              "prose-table:text-sm",
              "prose-th:bg-muted prose-th:p-2 prose-th:text-left",
              "prose-td:p-2 prose-td:border-t"
            )}
          >
            {content.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content.content}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground italic">
                No content generated yet
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
