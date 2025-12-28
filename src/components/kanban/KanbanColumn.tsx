"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Pencil, Check, X, MoreVertical, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Opportunity } from "@/types/opportunity";
import { SerializedKanbanColumn } from "@/types/view";
import { DraggableOpportunityCard } from "./DraggableOpportunityCard";
import { updateColumn, deleteColumn } from "@/lib/api/columns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatCurrencyCompact } from "@/lib/format";

export interface KanbanColumnProps {
  column: SerializedKanbanColumn;
  opportunities: Opportunity[];
  onOpenOpportunity?: (id: string) => void;
  isVirtualMode?: boolean;
  movingOpportunityId?: string | null;
  showOwner?: boolean;
}

export function KanbanColumn({ column, opportunities, onOpenOpportunity, isVirtualMode = false, movingOpportunityId, showOwner = false }: KanbanColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(column.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const count = opportunities.length;
  const totalArr = opportunities.reduce((sum, opp) => sum + opp.amountArr, 0);
  const { setNodeRef } = useDroppable({ id: column.id });
  const router = useRouter();

  // Disable editing in virtual mode
  const canEdit = !isVirtualMode;

  // Get quarter status from metadata (if available)
  const quarterStatus = column.metadata?.quarterStatus;

  const handleSave = async () => {
    if (!editedTitle.trim()) {
      toast.error("Column title cannot be empty");
      return;
    }

    try {
      await updateColumn(column.id, { title: editedTitle.trim() });
      toast.success("Column updated successfully");
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update column");
    }
  };

  const handleCancel = () => {
    setEditedTitle(column.title);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteColumn(column.id);
      toast.success("Column deleted successfully");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete column");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div
        className="flex flex-col bg-background-subtle/50 dark:bg-background-subtle rounded-xl border border-border/50 group transition-colors"
        style={{ borderTopColor: column.color || 'var(--primary)', borderTopWidth: "2px" }}
      >
        <div className="p-4 flex items-center justify-between gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
              />
              <Button size="sm" variant="ghost" onClick={handleSave} className="h-8 w-8 p-0">
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold tracking-tight truncate">
                    {column.title}
                  </h3>
                  {quarterStatus === "past" && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Past Due
                    </Badge>
                  )}
                  {quarterStatus === "current" && (
                    <Badge variant="default" className="text-xs bg-blue-500">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Current
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{count} deals</span>
                  {count > 0 && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatCurrencyCompact(totalArr)} ARR
                    </span>
                  )}
                </div>
                {column.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{column.subtitle}</p>
                )}
              </div>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-accent"
                      title="Column options"
                    >
                      <MoreVertical className="h-4 w-4 text-foreground/70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit name
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete column
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          )}
        </div>
      <Separator className="bg-border/30" />
      <ScrollArea className="h-[70vh] p-3">
        <div ref={setNodeRef} className="space-y-3 min-h-[200px]">
          {opportunities.map((opp) => (
            <DraggableOpportunityCard
              key={opp.id}
              opportunity={opp}
              onClick={onOpenOpportunity}
              isMoving={movingOpportunityId === opp.id}
              showOwner={showOwner}
            />
          ))}
          {count === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <span className="text-muted-foreground text-lg">0</span>
              </div>
              <p className="text-sm text-muted-foreground">No opportunities</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Drag deals here or create new ones</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>

    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Column</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{column.title}&quot;?
            {count > 0 && (
              <span className="block mt-2 font-medium text-destructive">
                Warning: This column contains {count} {count === 1 ? "opportunity" : "opportunities"}.
                They will be unassigned from this column but not deleted.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}

export default KanbanColumn;


