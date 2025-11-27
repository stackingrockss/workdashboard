"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { TaskWithRelations } from "@/types/task";
import { InlineDueDateEditor } from "./inline-due-date-editor";

interface TaskCardProps {
  task: TaskWithRelations;
  onComplete?: (taskId: string) => void;
  onDueDateChange?: (taskId: string, newDue: string | null) => void;
}

/**
 * Determines the badge variant based on due date
 * - Overdue (past): destructive (red)
 * - Today: default (primary)
 * - Future: secondary (gray)
 */
function getDueDateVariant(
  dueDate?: Date | null
): "destructive" | "default" | "secondary" {
  if (!dueDate) return "secondary";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) return "destructive"; // Overdue
  if (due.getTime() === today.getTime()) return "default"; // Today
  return "secondary"; // Future
}

/**
 * TaskCard - Displays a single task with quick actions
 *
 * Features:
 * - Color-coded due date badge with inline editing
 * - Linked opportunity badge (if task is linked)
 * - Mark complete button
 * - Hover effect
 */
export function TaskCard({ task, onComplete, onDueDateChange }: TaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);

  const handleDueDateChange = (newDue: string | null) => {
    onDueDateChange?.(task.id, newDue);
  };

  const handleMarkComplete = async () => {
    if (isCompleting) return;

    setIsCompleting(true);

    try {
      const response = await fetch(
        `/api/v1/tasks/lists/${task.taskListId}/tasks/${task.id}/complete`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to mark task complete");
      }

      toast.success("Task marked complete");
      onComplete?.(task.id);
    } catch (error) {
      console.error("Failed to mark task complete:", error);
      toast.error("Failed to mark task complete");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Task title */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm line-clamp-2 flex-1">
              {task.title}
            </h3>
          </div>

          {/* Due date and opportunity */}
          <div className="flex items-center gap-2 flex-wrap">
            <InlineDueDateEditor
              taskId={task.id}
              listId={task.taskListId}
              currentDue={task.due || null}
              onDueChange={handleDueDateChange}
              variant={getDueDateVariant(task.due)}
            />

            {task.opportunity && (
              <Link href={`/opportunities/${task.opportunityId}`}>
                <Badge
                  variant="outline"
                  className="hover:bg-accent cursor-pointer text-xs"
                >
                  {task.opportunity.name}
                </Badge>
              </Link>
            )}
          </div>

          {/* Quick action */}
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleMarkComplete}
              disabled={isCompleting}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {isCompleting ? "Completing..." : "Mark Complete"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
