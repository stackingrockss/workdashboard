"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContentBrief, BriefCategory, BRIEF_CATEGORY_LABELS } from "@/types/brief";
import { BriefCard } from "../frameworks/FrameworkCard";
import { Search, ChevronRight, FileText, Sparkles, Plus, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface BriefSelectionStepProps {
  selectedBrief: ContentBrief | null;
  onSelectBrief: (brief: ContentBrief | null) => void;
  onContinue: () => void;
  onCancel: () => void;
  isBlankDocumentSelected: boolean;
  onSelectBlankDocument: () => void;
  onCreateBlankDocument: () => void;
  creatingBlankDoc: boolean;
  blankDocCategory: BriefCategory;
  onBlankDocCategoryChange: (category: BriefCategory) => void;
}

// Categories that make sense for manual document creation (exclude other)
const MANUAL_DOC_CATEGORIES: BriefCategory[] = [
  "general",
  "notes",
  "pricing_proposal",
  "executive_summary",
  "account_plan",
  "internal_prep_doc",
  "email",
  "mutual_action_plan",
];

export const BriefSelectionStep = ({
  selectedBrief,
  onSelectBrief,
  onContinue,
  onCancel,
  isBlankDocumentSelected,
  onSelectBlankDocument,
  onCreateBlankDocument,
  creatingBlankDoc,
  blankDocCategory,
  onBlankDocCategoryChange,
}: BriefSelectionStepProps) => {
  const router = useRouter();
  const [scope, setScope] = useState<"all" | "company" | "personal">("all");
  const [search, setSearch] = useState("");
  const [briefs, setBriefs] = useState<ContentBrief[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch briefs
  useEffect(() => {
    const fetchBriefs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (scope !== "all") params.set("scope", scope);
        if (search) params.set("search", search);

        const response = await fetch(`/api/v1/briefs?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          let fetchedBriefs = data.briefs || [];

          // Auto-seed if no briefs exist
          if (fetchedBriefs.length === 0 && scope === "all" && !search) {
            try {
              const seedResponse = await fetch("/api/v1/briefs/seed", {
                method: "POST",
              });
              if (seedResponse.ok) {
                const retryResponse = await fetch(
                  `/api/v1/briefs?${params.toString()}`
                );
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  fetchedBriefs = retryData.briefs || [];
                }
              }
            } catch (seedError) {
              console.error("Failed to seed default briefs:", seedError);
            }
          }

          setBriefs(fetchedBriefs);
        }
      } catch (error) {
        console.error("Failed to fetch briefs:", error);
        toast.error("Failed to load briefs");
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchBriefs, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [scope, search]);

  // Parse sections for preview
  const selectedSections = selectedBrief
    ? Array.isArray(selectedBrief.sections)
      ? selectedBrief.sections
      : []
    : [];


  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <TabsList>
            <TabsTrigger value="all">All Briefs</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search briefs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/briefs/new")}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create New
          </Button>
        </div>
      </div>

      {/* Main content: Grid + Preview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Briefs grid (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Blank Document card - always first */}
            {!loading && (
              <Card
                className={cn(
                  "cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm border-dashed",
                  isBlankDocumentSelected && "border-primary ring-2 ring-primary/20 border-solid"
                )}
                onClick={onSelectBlankDocument}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      No Template
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">Blank Document</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Start with an empty document - no AI generation
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span>Pick a category to start</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading skeletons */}
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[160px] rounded-lg" />
              ))}

            {/* Brief cards */}
            {!loading &&
              briefs.map((brief) => (
                <BriefCard
                  key={brief.id}
                  brief={brief}
                  isSelected={selectedBrief?.id === brief.id}
                  onClick={() => onSelectBrief(brief)}
                  showEditButton
                />
              ))}

            {/* Empty state - only show if no briefs AND not searching */}
            {!loading && briefs.length === 0 && search && (
              <div className="col-span-full py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No briefs found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Preview panel (1/3 width on desktop) */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {isBlankDocumentSelected
                    ? "Blank Document"
                    : selectedBrief
                      ? "Brief Preview"
                      : "Select an Option"}
                </CardTitle>
                {selectedBrief && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/briefs/${selectedBrief.id}/edit`)}
                    className="h-8 px-2"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isBlankDocumentSelected ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-1">Blank Document</h3>
                    <p className="text-sm text-muted-foreground">
                      Create an empty document with no template or AI-generated content.
                    </p>
                  </div>

                  {/* Category picker */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Document Category
                    </p>
                    <Select
                      value={blankDocCategory}
                      onValueChange={(v) => onBlankDocCategoryChange(v as BriefCategory)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUAL_DOC_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {BRIEF_CATEGORY_LABELS[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {blankDocCategory === "mutual_action_plan"
                        ? "Creates a table-based document for tracking action items"
                        : "Creates a rich text document you can edit freely"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Features
                    </p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        {blankDocCategory === "mutual_action_plan" ? "Table editor for action items" : "Rich text editor"}
                      </li>
                      <li className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        {blankDocCategory === "mutual_action_plan" ? "Track owners, dates, status" : "Format text, add headers, lists"}
                      </li>
                      <li className="flex items-center gap-2">
                        <FileText className="h-3 w-3" />
                        Save and edit anytime
                      </li>
                    </ul>
                  </div>
                </div>
              ) : selectedBrief ? (
                <div className="space-y-4">
                  {/* Brief name and description */}
                  <div>
                    <h3 className="font-semibold mb-1">
                      {selectedBrief.name}
                    </h3>
                    {selectedBrief.description && (
                      <p className="text-sm text-muted-foreground">
                        {selectedBrief.description}
                      </p>
                    )}
                  </div>

                  {/* Sections */}
                  {selectedSections.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Sections
                      </p>
                      <div className="space-y-1">
                        {selectedSections.map((section, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <span className="w-5 h-5 rounded bg-muted flex items-center justify-center text-xs">
                              {i + 1}
                            </span>
                            {section.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Output format preview */}
                  {selectedBrief.outputFormat && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Output Template
                      </p>
                      <ScrollArea className="h-[200px] rounded-md border bg-muted/30 p-3">
                        <div className="prose prose-sm dark:prose-invert prose-headings:text-sm prose-headings:font-medium prose-p:text-xs prose-p:text-muted-foreground">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {selectedBrief.outputFormat}
                          </ReactMarkdown>
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    Choose a blank document or brief to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {isBlankDocumentSelected ? (
          <Button onClick={onCreateBlankDocument} disabled={creatingBlankDoc}>
            {creatingBlankDoc ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Create {BRIEF_CATEGORY_LABELS[blankDocCategory]}
              </>
            )}
          </Button>
        ) : (
          <Button onClick={onContinue} disabled={!selectedBrief}>
            Continue
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

// Backwards compatibility alias - deprecated, use BriefSelectionStep instead
/** @deprecated Use BriefSelectionStep instead */
export const FrameworkSelectionStep = BriefSelectionStep;
