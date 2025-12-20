"use client";

import { useState } from "react";
import { Document, DocumentType } from "@/types/document";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  onCreate: (document: Document) => void;
}

export const CreateDocumentDialog = ({
  open,
  onOpenChange,
  opportunityId,
  onCreate,
}: CreateDocumentDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<"rich_text" | "mutual_action_plan">("rich_text");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/v1/opportunities/${opportunityId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          documentType,
          content: documentType === "rich_text" ? "" : undefined,
          structuredData: documentType === "mutual_action_plan" ? { actionItems: [] } : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create document");
      }

      const result = await response.json();
      toast.success("Document created!");
      onCreate(result.document);
      onOpenChange(false);
      setTitle("");
      setDocumentType("rich_text");
    } catch (error) {
      console.error("Error creating document:", error);
      toast.error("Failed to create document");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTitle("");
      setDocumentType("rich_text");
      setError("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
          <DialogDescription>
            Create a blank document to write your own content
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Q1 Proposal Draft"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label>Document Type</Label>
            <RadioGroup
              value={documentType}
              onValueChange={(value) => setDocumentType(value as "rich_text" | "mutual_action_plan")}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="rich_text"
                  id="rich_text"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="rich_text"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <FileText className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Document</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Rich text editor
                  </span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="mutual_action_plan"
                  id="mutual_action_plan"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="mutual_action_plan"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <FileSpreadsheet className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">MAP</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Action items table
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
