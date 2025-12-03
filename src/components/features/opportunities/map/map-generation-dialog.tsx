"use client";

/**
 * MAPGenerationDialog Component
 *
 * Dialog for configuring MAP generation.
 * Allows user to select a template from Content Library.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, Sparkles } from "lucide-react";
import type { Content } from "@/types/content";

// ============================================================================
// Types
// ============================================================================

interface MAPGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingCount: number;
  onGenerate: (templateContentId?: string) => void;
  isRegenerate?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function MAPGenerationDialog({
  open,
  onOpenChange,
  meetingCount,
  onGenerate,
  isRegenerate = false,
}: MAPGenerationDialogProps) {
  const [templates, setTemplates] = useState<Content[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Fetch templates when dialog opens
  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  // Fetch MAP templates from Content Library
  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch("/api/v1/content?contentType=mutual_action_plan");
      if (!res.ok) {
        throw new Error("Failed to fetch templates");
      }
      const data = await res.json();
      setTemplates(data.contents || []);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      // Don't show error toast - templates are optional
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Handle generate
  const handleGenerate = () => {
    const templateId = selectedTemplateId === "none" ? undefined : selectedTemplateId;
    onGenerate(templateId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isRegenerate ? "Regenerate MAP" : "Generate Mutual Action Plan"}
          </DialogTitle>
          <DialogDescription>
            {isRegenerate
              ? "This will regenerate the MAP using AI. Any manual edits will be replaced."
              : "AI will analyze your meetings and create a project plan with milestones and action items."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Meeting count info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {meetingCount} meeting{meetingCount !== 1 ? "s" : ""} available
              </p>
              <p className="text-xs text-muted-foreground">
                Meeting data will be used to populate the plan
              </p>
            </div>
          </div>

          {/* Template selector */}
          <div className="space-y-2">
            <Label htmlFor="template">Template (optional)</Label>
            {isLoadingTemplates ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template (use default structure)</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Select a MAP template from your Content Library to guide the structure.
              {templates.length === 0 && !isLoadingTemplates && (
                <span className="block mt-1">
                  No templates found. Add MAP templates in Content Library with type
                  &quot;MAP Template&quot;.
                </span>
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate}>
            <Sparkles className="h-4 w-4 mr-2" />
            {isRegenerate ? "Regenerate" : "Generate"} MAP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
