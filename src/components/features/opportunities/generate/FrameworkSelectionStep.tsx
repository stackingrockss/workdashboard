"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ContentFramework } from "@/types/framework";
import { FrameworkCard } from "../frameworks/FrameworkCard";
import { Search, ChevronRight, FileText, Sparkles, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface FrameworkSelectionStepProps {
  selectedFramework: ContentFramework | null;
  onSelectFramework: (framework: ContentFramework | null) => void;
  onContinue: () => void;
  onCancel: () => void;
}

export const FrameworkSelectionStep = ({
  selectedFramework,
  onSelectFramework,
  onContinue,
  onCancel,
}: FrameworkSelectionStepProps) => {
  const router = useRouter();
  const [scope, setScope] = useState<"all" | "company" | "personal">("all");
  const [search, setSearch] = useState("");
  const [frameworks, setFrameworks] = useState<ContentFramework[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch frameworks
  useEffect(() => {
    const fetchFrameworks = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (scope !== "all") params.set("scope", scope);
        if (search) params.set("search", search);

        const response = await fetch(`/api/v1/frameworks?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          let fetchedFrameworks = data.frameworks || [];

          // Auto-seed if no frameworks exist
          if (fetchedFrameworks.length === 0 && scope === "all" && !search) {
            try {
              const seedResponse = await fetch("/api/v1/frameworks/seed", {
                method: "POST",
              });
              if (seedResponse.ok) {
                const retryResponse = await fetch(
                  `/api/v1/frameworks?${params.toString()}`
                );
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  fetchedFrameworks = retryData.frameworks || [];
                }
              }
            } catch (seedError) {
              console.error("Failed to seed default frameworks:", seedError);
            }
          }

          setFrameworks(fetchedFrameworks);
        }
      } catch (error) {
        console.error("Failed to fetch frameworks:", error);
        toast.error("Failed to load frameworks");
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchFrameworks, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [scope, search]);

  // Parse sections for preview
  const selectedSections = selectedFramework
    ? Array.isArray(selectedFramework.sections)
      ? selectedFramework.sections
      : []
    : [];


  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <TabsList>
            <TabsTrigger value="all">All Frameworks</TabsTrigger>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search frameworks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/frameworks/new")}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create New
          </Button>
        </div>
      </div>

      {/* Main content: Grid + Preview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Frameworks grid (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Loading skeletons */}
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[160px] rounded-lg" />
              ))}

            {/* Framework cards */}
            {!loading &&
              frameworks.map((framework) => (
                <FrameworkCard
                  key={framework.id}
                  framework={framework}
                  isSelected={selectedFramework?.id === framework.id}
                  onClick={() => onSelectFramework(framework)}
                />
              ))}

            {/* Empty state */}
            {!loading && frameworks.length === 0 && (
              <div className="col-span-full py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No frameworks found</p>
                {search && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your search
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview panel (1/3 width on desktop) */}
        <div className="lg:col-span-1">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {selectedFramework ? "Template Preview" : "Select a Framework"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedFramework ? (
                <div className="space-y-4">
                  {/* Framework name and description */}
                  <div>
                    <h3 className="font-semibold mb-1">
                      {selectedFramework.name}
                    </h3>
                    {selectedFramework.description && (
                      <p className="text-sm text-muted-foreground">
                        {selectedFramework.description}
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
                  {selectedFramework.outputFormat && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Output Template
                      </p>
                      <ScrollArea className="h-[200px] rounded-md border bg-muted/30 p-3">
                        <div className="prose prose-sm dark:prose-invert prose-headings:text-sm prose-headings:font-medium prose-p:text-xs prose-p:text-muted-foreground">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {selectedFramework.outputFormat}
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
                    Choose a framework to see its template structure
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
        <Button onClick={onContinue} disabled={!selectedFramework}>
          Continue
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

    </div>
  );
};
