"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  frameworkCreateSchema,
  FrameworkCreateInput,
} from "@/lib/validations/framework";
import {
  FrameworkCategory,
  ContentFramework,
} from "@/types/framework";
import { Loader2, Copy, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateFrameworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (framework: ContentFramework) => void;
  editFramework?: ContentFramework | null;
}

// Category options for tag selection - order matches the screenshot
const CATEGORY_OPTIONS: { value: FrameworkCategory; label: string }[] = [
  { value: "business_case", label: "Business Case" },
  { value: "mutual_action_plan", label: "Mutual Action Plan" },
  { value: "internal_prep_doc", label: "Internal Prep Doc" },
  { value: "email", label: "Email" },
  { value: "notes", label: "Notes" },
  { value: "general", label: "General" },
  { value: "proposal", label: "Proposal" },
  { value: "account_plan", label: "Account Plan" },
  { value: "executive_summary", label: "Executive Summary" },
];

export const CreateFrameworkDialog = ({
  open,
  onOpenChange,
  onCreated,
  editFramework,
}: CreateFrameworkDialogProps) => {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!editFramework;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FrameworkCreateInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(frameworkCreateSchema) as any,
    defaultValues: editFramework
      ? {
          name: editFramework.name,
          description: editFramework.description || "",
          category: editFramework.category,
          scope: editFramework.scope,
          systemInstruction: editFramework.systemInstruction,
          outputFormat: editFramework.outputFormat || "",
          sections: editFramework.sections || [{ title: "Content", required: true }],
        }
      : {
          name: "",
          description: "",
          category: "general",
          scope: "personal",
          systemInstruction: "",
          outputFormat: "",
          sections: [{ title: "Content", required: true }],
        },
  });

  const selectedCategory = watch("category");
  const selectedScope = watch("scope");

  const onSubmit = async (data: FrameworkCreateInput) => {
    setSubmitting(true);
    try {
      const url = isEditing
        ? `/api/v1/frameworks/${editFramework.id}`
        : "/api/v1/frameworks";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${isEditing ? "update" : "create"} framework`);
      }

      const result = await response.json();
      toast.success(`Framework ${isEditing ? "updated" : "created"} successfully!`);
      onCreated(result.framework);
      onOpenChange(false);
      reset();
    } catch (error) {
      console.error(`Failed to ${isEditing ? "update" : "create"} framework:`, error);
      toast.error(
        error instanceof Error ? error.message : `Failed to ${isEditing ? "update" : "create"} framework`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyName = () => {
    const name = watch("name");
    if (name) {
      setValue("name", `(Copy) ${name}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col">
        {/* Fixed Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>
            {isEditing ? "Edit Framework" : "Create Framework"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Define AI instructions and templates for generating sales content
          </p>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="create-framework-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Framework Title */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Framework Title <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  placeholder="e.g., 1-Click Business Case"
                  {...register("name")}
                />
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyName}
                    title="Copy framework"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Summary (Optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Summary (Optional)</Label>
              <Input
                id="description"
                placeholder="Brief description of what this framework is used for"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Framework Scope & Tags in a row on larger screens */}
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Framework Scope */}
              <div className="space-y-1.5">
                <Label>
                  Scope <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <label
                    htmlFor="scope-personal"
                    className={cn(
                      "flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-colors flex-1",
                      selectedScope === "personal"
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                  >
                    <input
                      type="radio"
                      id="scope-personal"
                      name="scope"
                      value="personal"
                      checked={selectedScope === "personal"}
                      onChange={() => setValue("scope", "personal")}
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Personal</span>
                  </label>
                  <label
                    htmlFor="scope-company"
                    className={cn(
                      "flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer transition-colors flex-1",
                      selectedScope === "company"
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                  >
                    <input
                      type="radio"
                      id="scope-company"
                      name="scope"
                      value="company"
                      checked={selectedScope === "company"}
                      onChange={() => setValue("scope", "company")}
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Company</span>
                  </label>
                </div>
                {errors.scope && (
                  <p className="text-sm text-destructive">{errors.scope.message}</p>
                )}
              </div>

              {/* Tags (Category) */}
              <div className="space-y-1.5">
                <Label>
                  Category <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map((option) => (
                    <Badge
                      key={option.value}
                      variant={
                        selectedCategory === option.value ? "default" : "outline"
                      }
                      className={cn(
                        "cursor-pointer transition-colors text-xs px-2 py-1",
                        selectedCategory === option.value ? "" : "hover:bg-muted"
                      )}
                      onClick={() => setValue("category", option.value)}
                    >
                      {option.label}
                    </Badge>
                  ))}
                </div>
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
                )}
              </div>
            </div>

            {/* Context (System Instruction) */}
            <div className="space-y-1.5">
              <Label htmlFor="systemInstruction">
                AI Instructions <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Instructions for the AI on how to generate content using opportunity context
              </p>
              <Textarea
                id="systemInstruction"
                placeholder="You are an enterprise sales expert helping to create a compelling executive summary and business case for a customer. Using the workspace context provided (which includes customer conversations, documents, call transcripts, and notes), generate personalized content..."
                className="min-h-[140px] font-mono text-sm resize-y"
                {...register("systemInstruction")}
              />
              {errors.systemInstruction && (
                <p className="text-sm text-destructive">{errors.systemInstruction.message}</p>
              )}
            </div>

            {/* Content Template (Output Format) */}
            <div className="space-y-1.5">
              <Label htmlFor="outputFormat">Output Template (Optional)</Label>
              <p className="text-xs text-muted-foreground">
                Define the structure for generated content (markdown supported)
              </p>
              <Textarea
                id="outputFormat"
                placeholder={`## Executive Summary
[Summary of the business case]

## Problem Statement
[Customer's current challenges]

## Recommended Approach
[Solution overview]`}
                className="min-h-[100px] font-mono text-sm resize-y"
                {...register("outputFormat")}
              />
              {errors.outputFormat && (
                <p className="text-sm text-destructive">{errors.outputFormat.message}</p>
              )}
            </div>
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" form="create-framework-form" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditing ? "Saving..." : "Creating..."}
              </>
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Create Framework"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
