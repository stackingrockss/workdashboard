"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  briefCreateSchema,
  BriefCreateInput,
} from "@/lib/validations/brief";
import {
  BriefCategory,
  ContentBrief,
} from "@/types/brief";
import { Content, CONTENT_TYPE_LABELS } from "@/types/content";
import { ArrowLeft, Loader2, Building2, User, FileText, FileCode, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateBriefPageProps {
  editBrief?: ContentBrief | null;
  returnTo?: string | null;
}

// Category options for tag selection
const CATEGORY_OPTIONS: { value: BriefCategory; label: string; description: string }[] = [
  { value: "business_impact_proposal", label: "Business Impact Proposal", description: "ROI and value propositions" },
  { value: "mutual_action_plan", label: "Mutual Action Plan", description: "Collaborative next steps" },
  { value: "executive_summary", label: "Executive Summary", description: "High-level overviews" },
  { value: "pricing_proposal", label: "Pricing Proposal", description: "Formal proposals and quotes" },
  { value: "email", label: "Email", description: "Follow-up and outreach" },
  { value: "account_plan", label: "Account Plan", description: "Strategic account planning" },
  { value: "internal_prep_doc", label: "Internal Prep Doc", description: "Meeting preparation" },
  { value: "notes", label: "Notes", description: "Meeting and call notes" },
  { value: "general", label: "General", description: "Other content types" },
];

export const CreateBriefPage = ({ editBrief, returnTo }: CreateBriefPageProps) => {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!editBrief;

  // Content library state
  const [contents, setContents] = useState<Content[]>([]);
  const [contentsLoading, setContentsLoading] = useState(true);
  const [contentSearch, setContentSearch] = useState("");
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>(
    editBrief?.referenceContents?.map((c) => c.id) || []
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<BriefCreateInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(briefCreateSchema) as any,
    defaultValues: editBrief
      ? {
          name: editBrief.name,
          description: editBrief.description || "",
          category: editBrief.category,
          // Templates cannot be edited - use "personal" as fallback for type safety
          scope: editBrief.scope === "template" ? "personal" : editBrief.scope,
          systemInstruction: editBrief.systemInstruction,
          outputFormat: editBrief.outputFormat || "",
          sections: editBrief.sections || [{ title: "Content", required: true }],
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

  // Fetch content library
  useEffect(() => {
    const fetchContents = async () => {
      try {
        const response = await fetch("/api/v1/content?limit=100");
        if (response.ok) {
          const data = await response.json();
          setContents(data.contents || []);
        }
      } catch (error) {
        console.error("Failed to fetch contents:", error);
      } finally {
        setContentsLoading(false);
      }
    };

    fetchContents();
  }, []);

  // Filter contents by search
  const filteredContents = useMemo(() => {
    if (!contentSearch) return contents;
    return contents.filter((content) =>
      content.title.toLowerCase().includes(contentSearch.toLowerCase())
    );
  }, [contents, contentSearch]);

  // Toggle content selection
  const toggleContent = (contentId: string) => {
    setSelectedContentIds((prev) =>
      prev.includes(contentId)
        ? prev.filter((id) => id !== contentId)
        : [...prev, contentId]
    );
  };

  const handleClearContents = () => {
    setSelectedContentIds([]);
  };

  const onSubmit = async (data: BriefCreateInput) => {
    setSubmitting(true);
    try {
      const url = isEditing
        ? `/api/v1/briefs/${editBrief.id}`
        : "/api/v1/briefs";
      const method = isEditing ? "PATCH" : "POST";

      // Include selected content IDs in the request
      const requestData = {
        ...data,
        referenceContentIds: selectedContentIds,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${isEditing ? "update" : "create"} brief`);
      }

      toast.success(`Brief ${isEditing ? "updated" : "created"} successfully!`);
      router.push(returnTo || "/briefs");
    } catch (error) {
      console.error(`Failed to ${isEditing ? "update" : "create"} brief:`, error);
      toast.error(
        error instanceof Error ? error.message : `Failed to ${isEditing ? "update" : "create"} brief`
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
          <Link href={returnTo || "/briefs"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {isEditing ? "Edit Brief" : "Create Brief"}
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
            <CardDescription>Name and describe your brief</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Brief Name <span className="text-destructive">*</span>
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
                  placeholder="Brief description of what this generates"
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
            <CardDescription>Control who can use this brief and how it&apos;s categorized</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Scope Selection */}
            <div className="space-y-3">
              <Label>
                Brief Scope <span className="text-destructive">*</span>
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
              <FileText className="h-4 w-4" />
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
- Highlights the customer's specific pain points
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

        {/* Reference Examples Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Reference Examples
                  {selectedContentIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedContentIds.length} selected
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Optional: Select content from your library to guide the AI on tone and structure.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearContents}
                disabled={selectedContentIds.length === 0}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
            {/* Search */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content library..."
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {contentsLoading ? (
              <div className="py-6 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                Loading content library...
              </div>
            ) : contents.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <FileCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No content in your library</p>
                <p className="text-xs mt-1">
                  Add content items in the Content page to use as references.
                </p>
              </div>
            ) : filteredContents.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No content matches your search</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-1">
                  {filteredContents.map((content) => (
                    <div
                      key={content.id}
                      className={cn(
                        "flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
                        selectedContentIds.includes(content.id) &&
                          "bg-primary/5 border border-primary/20"
                      )}
                      onClick={() => toggleContent(content.id)}
                    >
                      <Checkbox
                        checked={selectedContentIds.includes(content.id)}
                        onCheckedChange={() => toggleContent(content.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">
                          {content.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 capitalize"
                          >
                            {CONTENT_TYPE_LABELS[content.contentType] || content.contentType}
                          </Badge>
                          {content.description && (
                            <span className="truncate">{content.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              These examples will be pre-selected when generating content with this brief.
              Users can also add additional examples during generation.
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button type="button" variant="outline" asChild>
            <Link href={returnTo || "/briefs"}>Cancel</Link>
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
              "Create Brief"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
