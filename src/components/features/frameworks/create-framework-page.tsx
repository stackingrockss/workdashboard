"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  frameworkCreateSchema,
  FrameworkCreateInput,
} from "@/lib/validations/framework";
import {
  FrameworkCategory,
  ContentFramework,
} from "@/types/framework";
import { ArrowLeft, Loader2, Building2, User, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateFrameworkPageProps {
  editFramework?: ContentFramework | null;
}

// Category options for tag selection
const CATEGORY_OPTIONS: { value: FrameworkCategory; label: string; description: string }[] = [
  { value: "business_case", label: "Business Case", description: "ROI and value propositions" },
  { value: "mutual_action_plan", label: "Mutual Action Plan", description: "Collaborative next steps" },
  { value: "executive_summary", label: "Executive Summary", description: "High-level overviews" },
  { value: "proposal", label: "Proposal", description: "Formal proposals and quotes" },
  { value: "email", label: "Email", description: "Follow-up and outreach" },
  { value: "account_plan", label: "Account Plan", description: "Strategic account planning" },
  { value: "internal_prep_doc", label: "Internal Prep Doc", description: "Meeting preparation" },
  { value: "notes", label: "Notes", description: "Meeting and call notes" },
  { value: "general", label: "General", description: "Other content types" },
];

export const CreateFrameworkPage = ({ editFramework }: CreateFrameworkPageProps) => {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!editFramework;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
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

      toast.success(`Framework ${isEditing ? "updated" : "created"} successfully!`);
      router.push("/frameworks");
    } catch (error) {
      console.error(`Failed to ${isEditing ? "update" : "create"} framework:`, error);
      toast.error(
        error instanceof Error ? error.message : `Failed to ${isEditing ? "update" : "create"} framework`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/frameworks">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {isEditing ? "Edit Framework" : "Create Framework"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Define AI instructions and templates for generating sales content
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription>Name and describe your framework</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Framework Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Executive Business Case"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Summary</Label>
                <Input
                  id="description"
                  placeholder="Brief description of what this framework generates"
                  {...register("description")}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scope & Category Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visibility & Category</CardTitle>
            <CardDescription>Control who can use this framework and how it&apos;s categorized</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Scope Selection */}
            <div className="space-y-3">
              <Label>
                Framework Scope <span className="text-destructive">*</span>
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label
                  htmlFor="scope-personal"
                  className={cn(
                    "flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-colors",
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
                    className="mt-1 h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Personal</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Only visible to you. Great for personal templates and experiments.
                    </p>
                  </div>
                </label>
                <label
                  htmlFor="scope-company"
                  className={cn(
                    "flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-colors",
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
                    className="mt-1 h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Company</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Shared with your entire organization. Ideal for standardized templates.
                    </p>
                  </div>
                </label>
              </div>
              {errors.scope && (
                <p className="text-sm text-destructive">{errors.scope.message}</p>
              )}
            </div>

            <Separator />

            {/* Category Selection */}
            <div className="space-y-3">
              <Label>
                Category <span className="text-destructive">*</span>
              </Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {CATEGORY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-colors",
                      selectedCategory === option.value
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    )}
                    onClick={() => setValue("category", option.value)}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={option.value}
                      checked={selectedCategory === option.value}
                      onChange={() => setValue("category", option.value)}
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-sm">{option.label}</span>
                      <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Instructions
            </CardTitle>
            <CardDescription>
              Tell the AI how to generate content. Be specific about tone, structure, and what information to include.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="systemInstruction">
                System Prompt <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="systemInstruction"
                placeholder={`Example: You are an enterprise sales expert helping to create compelling business cases for customers.

Using the opportunity context provided (call transcripts, notes, and account research), generate a personalized business case that:
- Highlights the customer&apos;s specific pain points
- Quantifies the business impact
- Presents our solution as the clear choice
- Includes relevant metrics and ROI projections

Write in a professional but conversational tone.`}
                className="min-h-[200px] font-mono text-sm"
                {...register("systemInstruction")}
              />
              {errors.systemInstruction && (
                <p className="text-sm text-destructive">{errors.systemInstruction.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                This prompt will be sent to the AI along with the opportunity context you select.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Output Template Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Output Template
            </CardTitle>
            <CardDescription>
              Optional: Define the structure for generated content. The AI will follow this format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="outputFormat">Template (Markdown)</Label>
              <Textarea
                id="outputFormat"
                placeholder={`## Executive Summary
[Brief overview of the opportunity and recommendation]

## Current Situation
[Customer's current challenges and pain points]

## Proposed Solution
[How our solution addresses their needs]

## Business Impact
[Quantified benefits and ROI projections]

## Next Steps
[Recommended actions and timeline]`}
                className="min-h-[200px] font-mono text-sm"
                {...register("outputFormat")}
              />
              {errors.outputFormat && (
                <p className="text-sm text-destructive">{errors.outputFormat.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Use markdown formatting. The AI will replace bracketed placeholders with generated content.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/frameworks">Cancel</Link>
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
    </div>
  );
};
