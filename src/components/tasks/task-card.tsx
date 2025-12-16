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
import { parseAsLocalDate } from "@/lib/utils/task-filtering";

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
  dueDate?: Date | string | null
): "destructive" | "default" | "secondary" {
  if (!dueDate) return "secondary";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = parseAsLocalDate(dueDate);
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
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to mark task complete");
      }

      toast.success("Task marked complete");
      onComplete?.(task.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to mark task complete";
      console.error("Failed to mark task complete:", errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Task title */}
          <h3 className="font-semibold text-sm line-clamp-2">
            {task.title}
          </h3>

          {/* Due date, opportunity, and quick action */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
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
                    className="hover:bg-accent cursor-pointer text-xs truncate max-w-[120px]"
                  >
                    {task.opportunity.name}
                  </Badge>
                </Link>
              )}
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 flex-shrink-0"
              onClick={handleMarkComplete}
              disabled={isCompleting}
              title="Mark Complete"
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
