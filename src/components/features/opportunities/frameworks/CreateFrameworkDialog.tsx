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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Framework" : "Create Framework"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-4">
            {/* Framework Title */}
            <div className="space-y-2">
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
            <div className="space-y-2">
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

            {/* Framework Scope */}
            <div className="space-y-2">
              <Label>
                Framework Scope <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={selectedScope}
                onValueChange={(value) => setValue("scope", value as "personal" | "company")}
                className="flex gap-4"
              >
                <div
                  className={cn(
                    "flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-colors flex-1",
                    selectedScope === "personal"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                  onClick={() => setValue("scope", "personal")}
                >
                  <RadioGroupItem value="personal" id="scope-personal" />
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label
                        htmlFor="scope-personal"
                        className="font-medium cursor-pointer"
                      >
                        Personal
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Only visible to you
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-colors flex-1",
                    selectedScope === "company"
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  )}
                  onClick={() => setValue("scope", "company")}
                >
                  <RadioGroupItem value="company" id="scope-company" />
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label
                        htmlFor="scope-company"
                        className="font-medium cursor-pointer"
                      >
                        Company
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Visible to your organization
                      </p>
                    </div>
                  </div>
                </div>
              </RadioGroup>
              {errors.scope && (
                <p className="text-sm text-destructive">{errors.scope.message}</p>
              )}
            </div>

            {/* Tags (Category) */}
            <div className="space-y-2">
              <Label>
                Tags <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => (
                  <Badge
                    key={option.value}
                    variant={
                      selectedCategory === option.value ? "default" : "outline"
                    }
                    className={cn(
                      "cursor-pointer transition-colors px-3 py-1.5",
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

            {/* Context (System Instruction) */}
            <div className="space-y-2">
              <Label htmlFor="systemInstruction">
                Context <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                Instructions and context for AI generation
              </p>
              <Textarea
                id="systemInstruction"
                placeholder="You are an enterprise sales expert helping to create a compelling executive summary and business case for a customer. Using the workspace context provided (which includes customer conversations, documents, call transcripts, and notes), generate personalized content for this business case framework..."
                className="min-h-[200px] font-mono text-sm"
                {...register("systemInstruction")}
              />
              {errors.systemInstruction && (
                <p className="text-sm text-destructive">{errors.systemInstruction.message}</p>
              )}
            </div>

            {/* Content Template (Output Format) */}
            <div className="space-y-2">
              <Label htmlFor="outputFormat">Content Template</Label>
              <p className="text-sm text-muted-foreground">
                Optional: Define the structure and format for AI-generated content (markdown supported)
              </p>
              <Textarea
                id="outputFormat"
                placeholder={`## Executive Summary
[Summary of the business case]

## Problem Statement
[Customer's current challenges]

## Recommended Approach
[Solution overview]

## Expected Outcomes
[Business impact and metrics]`}
                className="min-h-[150px] font-mono text-sm"
                {...register("outputFormat")}
              />
              {errors.outputFormat && (
                <p className="text-sm text-destructive">{errors.outputFormat.message}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
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
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
