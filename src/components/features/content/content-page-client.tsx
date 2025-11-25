"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Plus } from "lucide-react";
import { Content, ContentType, CONTENT_TYPE_LABELS } from "@/types/content";
import { getContents, deleteContent } from "@/lib/api/content";
import { ContentCard } from "./content-card";
import { AddContentDialog } from "./add-content-dialog";

interface ContentPageClientProps {
  initialContents: Content[];
}

export function ContentPageClient({ initialContents }: ContentPageClientProps) {
  const router = useRouter();
  const [contents, setContents] = useState<Content[]>(initialContents);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const filteredContents = useMemo(() => {
    if (filterType === "all") return contents;
    return contents.filter((c) => c.contentType === filterType);
  }, [contents, filterType]);

  const fetchContents = async () => {
    try {
      const data = await getContents();
      setContents(data);
    } catch {
      toast.error("Failed to refresh content");
    }
  };

  const handleAddSuccess = () => {
    fetchContents();
    router.refresh();
  };

  const handleEdit = (content: Content) => {
    setEditingContent(content);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (content: Content) => {
    if (!confirm(`Delete "${content.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteContent(content.id);
      toast.success("Content deleted successfully!");
      fetchContents();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete content"
      );
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsAddDialogOpen(open);
    if (!open) {
      setEditingContent(null);
    }
  };

  // Sync with server data
  useEffect(() => {
    setContents(initialContents);
  }, [initialContents]);

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Content</h1>
          <p className="text-muted-foreground">
            Share valuable content with contacts between meetings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {filteredContents.length}{" "}
            {filteredContents.length === 1 ? "item" : "items"}
          </Badge>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Content
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {CONTENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content Grid */}
      {filteredContents.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {filterType === "all"
                ? "No content yet"
                : `No ${CONTENT_TYPE_LABELS[filterType as ContentType]} content`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {filterType === "all"
                ? "Add blog posts, case studies, videos, and other content to share with contacts."
                : "Try selecting a different content type or add new content."}
            </p>
            {filterType === "all" && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Content
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredContents.map((content) => (
            <ContentCard
              key={content.id}
              content={content}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <AddContentDialog
        open={isAddDialogOpen}
        onOpenChange={handleDialogClose}
        onSuccess={handleAddSuccess}
        editingContent={editingContent}
      />
    </div>
  );
}
