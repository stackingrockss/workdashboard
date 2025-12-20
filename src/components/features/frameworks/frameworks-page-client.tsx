"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Sparkles,
} from "lucide-react";
import { FrameworkCategory, FRAMEWORK_CATEGORY_LABELS } from "@/types/framework";
import { formatDateShort } from "@/lib/format";
import { toast } from "sonner";

interface Framework {
  id: string;
  name: string;
  description: string | null;
  category: FrameworkCategory;
  scope: "company" | "personal";
  systemInstruction: string;
  outputFormat: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  createdBy: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface FrameworksPageClientProps {
  frameworks: Framework[];
  currentUserId: string;
}

export const FrameworksPageClient = ({
  frameworks: initialFrameworks,
  currentUserId,
}: FrameworksPageClientProps) => {
  const [frameworks, setFrameworks] = useState(initialFrameworks);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterScope, setFilterScope] = useState<"all" | "personal" | "company">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter frameworks
  const filteredFrameworks = frameworks.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesScope =
      filterScope === "all" ||
      f.scope === filterScope;
    return matchesSearch && matchesScope;
  });

  // Group by scope
  const companyFrameworks = filteredFrameworks.filter((f) => f.scope === "company");
  const personalFrameworks = filteredFrameworks.filter((f) => f.scope === "personal");

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/v1/frameworks/${deleteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete framework");
      }

      setFrameworks((prev) => prev.filter((f) => f.id !== deleteId));
      toast.success("Framework deleted");
    } catch (error) {
      toast.error("Failed to delete framework");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const FrameworkCard = ({ framework }: { framework: Framework }) => {
    const isOwner = framework.createdById === currentUserId;

    return (
      <Card className="group hover:border-primary/50 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {framework.scope === "company" ? (
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <CardTitle className="text-base truncate">{framework.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {FRAMEWORK_CATEGORY_LABELS[framework.category]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {framework.usageCount} uses
                </span>
              </div>
            </div>
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/frameworks/${framework.id}/edit`}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteId(framework.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {framework.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {framework.description}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Created {formatDateShort(framework.createdAt)}
              {framework.createdBy.name && ` by ${framework.createdBy.name}`}
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
              placeholder="Search frameworks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 border rounded-lg p-1">
            {(["all", "personal", "company"] as const).map((scope) => (
              <Button
                key={scope}
                variant={filterScope === scope ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilterScope(scope)}
                className="capitalize"
              >
                {scope}
              </Button>
            ))}
          </div>
        </div>
        <Button asChild>
          <Link href="/frameworks/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Framework
          </Link>
        </Button>
      </div>

      {/* Empty State */}
      {filteredFrameworks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium mb-1">No frameworks found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? "Try adjusting your search query"
                : "Create your first framework to generate AI-powered sales content"}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/frameworks/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Framework
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Company Frameworks */}
      {companyFrameworks.length > 0 && (filterScope === "all" || filterScope === "company") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Company Frameworks</h2>
            <Badge variant="secondary" className="text-xs">
              {companyFrameworks.length}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companyFrameworks.map((framework) => (
              <FrameworkCard key={framework.id} framework={framework} />
            ))}
          </div>
        </div>
      )}

      {/* Personal Frameworks */}
      {personalFrameworks.length > 0 && (filterScope === "all" || filterScope === "personal") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Personal Frameworks</h2>
            <Badge variant="secondary" className="text-xs">
              {personalFrameworks.length}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {personalFrameworks.map((framework) => (
              <FrameworkCard key={framework.id} framework={framework} />
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Framework?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this framework. Any generated content using this
              framework will not be affected.
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
