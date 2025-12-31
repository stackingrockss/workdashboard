"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Building2,
  User,
  FileText,
  Copy,
  LayoutTemplate,
  Eye,
} from "lucide-react";
import { BriefCategory, BRIEF_CATEGORY_LABELS } from "@/types/brief";
import { formatDateShort } from "@/lib/format";
import { toast } from "sonner";

interface Brief {
  id: string;
  name: string;
  description: string | null;
  category: BriefCategory;
  scope: "company" | "personal" | "template";
  systemInstruction: string;
  outputFormat: string | null;
  createdById: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  usageCount: number;
  createdBy: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}

interface BriefsPageClientProps {
  briefs: Brief[];
  currentUserId: string;
}

export const BriefsPageClient = ({
  briefs: initialBriefs,
  currentUserId,
}: BriefsPageClientProps) => {
  const [briefs, setBriefs] = useState(initialBriefs);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterScope, setFilterScope] = useState<"all" | "personal" | "company" | "templates">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Filter briefs
  const filteredBriefs = briefs.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesScope =
      filterScope === "all" ||
      (filterScope === "templates" && b.scope === "template") ||
      b.scope === filterScope;
    return matchesSearch && matchesScope;
  });

  // Group by scope
  const templateBriefs = filteredBriefs.filter((b) => b.scope === "template");
  const companyBriefs = filteredBriefs.filter((b) => b.scope === "company");
  const personalBriefs = filteredBriefs.filter((b) => b.scope === "personal");

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/v1/briefs/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete brief");
      }

      setBriefs((prev) => prev.filter((b) => b.id !== deleteId));
      toast.success("Brief deleted");
    } catch (error) {
      toast.error("Failed to delete brief");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (briefId: string) => {
    setDuplicatingId(briefId);
    try {
      const response = await fetch(`/api/v1/briefs/${briefId}/duplicate`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to duplicate brief");
      }

      const data = await response.json();
      // Add the new brief to the list
      setBriefs((prev) => [data.brief, ...prev]);
      toast.success("Brief duplicated");
    } catch (error) {
      toast.error("Failed to duplicate brief");
    } finally {
      setDuplicatingId(null);
    }
  };

  const BriefCard = ({ brief }: { brief: Brief }) => {
    const isOwner = brief.createdById === currentUserId;
    const isTemplate = brief.scope === "template";

    return (
      <Card className="group hover:border-primary/50 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {brief.scope === "template" ? (
                  <LayoutTemplate className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : brief.scope === "company" ? (
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <CardTitle className="text-base truncate">{brief.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {BRIEF_CATEGORY_LABELS[brief.category]}
                </Badge>
                {!isTemplate && (
                  <span className="text-xs text-muted-foreground">
                    {brief.usageCount} uses
                  </span>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={duplicatingId === brief.id}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isTemplate && (
                  <DropdownMenuItem asChild>
                    <Link href={`/briefs/${brief.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Link>
                  </DropdownMenuItem>
                )}
                {!isTemplate && isOwner && (
                  <DropdownMenuItem asChild>
                    <Link href={`/briefs/${brief.id}/edit`}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => handleDuplicate(brief.id)}
                  disabled={duplicatingId === brief.id}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {duplicatingId === brief.id ? "Duplicating..." : "Duplicate"}
                </DropdownMenuItem>
                {!isTemplate && isOwner && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteId(brief.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {brief.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {brief.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isTemplate ? (
                "Built-in template"
              ) : (
                <>
                  Created {formatDateShort(brief.createdAt)}
                  {brief.createdBy?.name && ` by ${brief.createdBy.name}`}
                </>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search briefs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "templates", "company", "personal"] as const).map((scope) => (
              <button
                key={scope}
                onClick={() => setFilterScope(scope)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-full border transition-colors capitalize",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  filterScope === scope
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>
        <Button asChild>
          <Link href="/briefs/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Brief
          </Link>
        </Button>
      </div>

      {/* Empty State */}
      {filteredBriefs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">No briefs found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? "Try adjusting your search query"
                : "Create your first brief to generate AI-powered sales content"}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/briefs/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Brief
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Template Briefs */}
      {templateBriefs.length > 0 && (filterScope === "all" || filterScope === "templates") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Templates</h2>
            <Badge variant="secondary" className="text-xs">
              {templateBriefs.length}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templateBriefs.map((brief) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        </div>
      )}

      {/* Company Briefs */}
      {companyBriefs.length > 0 && (filterScope === "all" || filterScope === "company") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Company Briefs</h2>
            <Badge variant="secondary" className="text-xs">
              {companyBriefs.length}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companyBriefs.map((brief) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        </div>
      )}

      {/* Personal Briefs */}
      {personalBriefs.length > 0 && (filterScope === "all" || filterScope === "personal") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Personal Briefs</h2>
            <Badge variant="secondary" className="text-xs">
              {personalBriefs.length}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personalBriefs.map((brief) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brief?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this brief. Any generated content using this
              brief will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
