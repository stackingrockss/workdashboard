"use client";

/**
 * ManageViewsDialog Component
 * Dialog for managing custom views (rename, duplicate, delete, set default)
 */

import { useState } from "react";
import { Pencil, Copy, Trash2, Star, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SerializedKanbanView, MAX_VIEWS_PER_USER } from "@/types/view";
import { updateView, duplicateView, deleteView } from "@/lib/api/views";
import { toast } from "sonner";

interface ManageViewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  views: SerializedKanbanView[];
  onViewsChanged: () => void;
}

export function ManageViewsDialog({
  open,
  onOpenChange,
  views,
  onViewsChanged,
}: ManageViewsDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const customViews = views.filter((v) => v.viewType === "custom");
  const viewCount = customViews.length;

  const handleStartEdit = (view: SerializedKanbanView) => {
    setEditingId(view.id);
    setEditingName(view.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (viewId: string) => {
    if (!editingName.trim()) {
      toast.error("View name cannot be empty");
      return;
    }

    setIsLoading(true);
    try {
      await updateView(viewId, { name: editingName.trim() });
      toast.success("View renamed successfully");
      setEditingId(null);
      onViewsChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename view");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDefault = async (view: SerializedKanbanView) => {
    setIsLoading(true);
    try {
      await updateView(view.id, { isDefault: !view.isDefault });
      toast.success(view.isDefault ? "Default unset" : "Set as default");
      onViewsChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update view");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicate = async (view: SerializedKanbanView) => {
    if (viewCount >= MAX_VIEWS_PER_USER) {
      toast.error(`Maximum ${MAX_VIEWS_PER_USER} views reached`);
      return;
    }

    setDuplicatingId(view.id);
    try {
      await duplicateView(view.id, {
        newName: `${view.name} (Copy)`,
        includeColumns: true,
      });
      toast.success("View duplicated successfully");
      onViewsChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate view");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;

    setIsLoading(true);
    try {
      await deleteView(deletingId);
      toast.success("View deleted successfully");
      setDeletingId(null);
      onViewsChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete view");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Views</DialogTitle>
            <DialogDescription>
              Rename, duplicate, or delete your custom views. You have {viewCount} of {MAX_VIEWS_PER_USER} views.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[500px] pr-4">
            <div className="space-y-2">
              {customViews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No custom views yet. Create one to get started!
                </div>
              ) : (
                customViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    {/* View Name (editable) */}
                    <div className="flex-1 min-w-0">
                      {editingId === view.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(view.id);
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                            className="h-8"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveEdit(view.id)}
                            disabled={isLoading}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={isLoading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{view.name}</span>
                          <div className="flex gap-1">
                            {view.isActive && (
                              <Badge variant="default" className="text-xs">
                                Active
                              </Badge>
                            )}
                            {view.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {view.columns?.length || 0} columns
                        {view.lastAccessedAt &&
                          ` · Last accessed ${new Date(view.lastAccessedAt).toLocaleDateString()}`}
                      </div>
                    </div>

                    {/* Actions */}
                    {editingId !== view.id && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleDefault(view)}
                          disabled={isLoading}
                          title={view.isDefault ? "Unset as default" : "Set as default"}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              view.isDefault ? "fill-yellow-400 text-yellow-400" : ""
                            }`}
                          />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(view)}
                          disabled={isLoading}
                          title="Rename"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDuplicate(view)}
                          disabled={
                            isLoading ||
                            duplicatingId === view.id ||
                            viewCount >= MAX_VIEWS_PER_USER
                          }
                          title="Duplicate"
                        >
                          {duplicatingId === view.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingId(view.id)}
                          disabled={isLoading || customViews.length <= 1}
                          title={
                            customViews.length <= 1
                              ? "Cannot delete the only view"
                              : "Delete"
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete View?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the view and all its columns. Opportunities assigned to these columns will be unassigned. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
