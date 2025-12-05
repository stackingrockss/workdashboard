"use client";

/**
 * MAPHeader Component
 *
 * Header section for the MAP displaying:
 * - Editable title
 * - Progress bar
 * - Metadata (generated date, last edited)
 * - Actions (regenerate, export)
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RefreshCw,
  Download,
  Copy,
  Check,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateShort } from "@/lib/format";
import type { MAPActionItem } from "@/types/mutual-action-plan";

// ============================================================================
// Types
// ============================================================================

interface MAPHeaderProps {
  title: string;
  generatedAt?: string;
  lastEditedAt?: string;
  lastEditedBy?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
  onTitleChange: (title: string) => void;
  onRegenerate: () => void;
  actionItems: MAPActionItem[];
}

// ============================================================================
// Component
// ============================================================================

export function MAPHeader({
  title,
  generatedAt,
  lastEditedAt,
  lastEditedBy,
  onTitleChange,
  onRegenerate,
  actionItems,
}: MAPHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [copied, setCopied] = useState(false);

  // Calculate progress
  const completedCount = actionItems.filter(
    (item) => item.status === "completed"
  ).length;
  const totalCount = actionItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Handle title save
  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== title) {
      onTitleChange(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  // Handle title cancel
  const handleTitleCancel = () => {
    setEditedTitle(title);
    setIsEditingTitle(false);
  };

  // Copy MAP as markdown
  const copyAsMarkdown = () => {
    const markdown = generateMarkdown(title, actionItems);
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    toast.success("MAP copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Download as CSV
  const downloadAsCSV = () => {
    const csv = generateCSV(actionItems);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          {/* Title */}
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-lg font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") handleTitleCancel();
                  }}
                />
                <Button size="sm" onClick={handleTitleSave}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleTitleCancel}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{title}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setIsEditingTitle(true)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              {generatedAt && (
                <span>Generated {formatDateShort(generatedAt)}</span>
              )}
              {lastEditedAt && lastEditedBy && (
                <span>
                  Last edited by {lastEditedBy.name || "Unknown"}{" "}
                  {formatDateShort(lastEditedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={copyAsMarkdown}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadAsCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {completedCount} of {totalCount} completed ({Math.round(progressPercent)}%)
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateMarkdown(title: string, items: MAPActionItem[]): string {
  let md = `# ${title}\n\n`;
  md += `| Target Date | Description | Status | Completion Date | Owner | Notes |\n`;
  md += `|-------------|-------------|--------|-----------------|-------|-------|\n`;

  items.forEach((item) => {
    const targetDate = item.targetDate || "";
    const completionDate = item.completionDate || "";
    const status = item.status.replace(/_/g, " ");
    const notes = item.notes || "";
    md += `| ${targetDate} | ${item.description} | ${status} | ${completionDate} | ${item.owner} | ${notes} |\n`;
  });

  return md;
}

function generateCSV(items: MAPActionItem[]): string {
  const headers = [
    "Target Date",
    "Description",
    "Status",
    "Completion Date",
    "Owner",
    "Notes",
  ];
  const rows = items.map((item) => [
    item.targetDate || "",
    `"${item.description.replace(/"/g, '""')}"`,
    item.status.replace(/_/g, " "),
    item.completionDate || "",
    item.owner,
    `"${(item.notes || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}
