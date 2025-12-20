"use client";

import { Document, DOCUMENT_TYPE_LABELS } from "@/types/document";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  FileSpreadsheet,
  Sparkles,
  Clock,
  Loader2,
  Trash2,
  User,
} from "lucide-react";
import { formatDateShort } from "@/lib/format";

interface DocumentCardProps {
  document: Document;
  isGenerating?: boolean;
  onClick: () => void;
  onDelete: () => void;
}

export const DocumentCard = ({
  document,
  isGenerating = false,
  onClick,
  onDelete,
}: DocumentCardProps) => {
  const getIcon = () => {
    if (isGenerating) {
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    }
    switch (document.documentType) {
      case "mutual_action_plan":
        return <FileSpreadsheet className="h-5 w-5 text-blue-500" />;
      case "framework_generated":
        return <Sparkles className="h-5 w-5 text-purple-500" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPreview = () => {
    if (document.documentType === "mutual_action_plan" && document.structuredData) {
      const actionItems = document.structuredData.actionItems || [];
      return `${actionItems.length} action item${actionItems.length !== 1 ? "s" : ""}`;
    }
    if (document.content) {
      // Get first 100 characters of content
      return document.content.slice(0, 100).replace(/[#*_]/g, "").trim() + (document.content.length > 100 ? "..." : "");
    }
    if (isGenerating) {
      return "Generating content...";
    }
    return "No content yet";
  };

  const getLastEditedInfo = () => {
    if (document.lastEditedBy && document.lastEditedAt) {
      return `Edited by ${document.lastEditedBy.name || "Unknown"} on ${formatDateShort(document.lastEditedAt)}`;
    }
    if (document.generatedAt) {
      return `Generated on ${formatDateShort(document.generatedAt)}`;
    }
    return `Created on ${formatDateShort(document.createdAt)}`;
  };

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm truncate">
                {document.title}
              </h4>
              {document.version > 1 && (
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  v{document.version}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {DOCUMENT_TYPE_LABELS[document.documentType]}
              </Badge>
              {document.framework && (
                <Badge variant="secondary" className="text-xs">
                  {document.framework.name}
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {getPreview()}
            </p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {getLastEditedInfo()}
              </span>
            </div>
          </div>

          <div
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
