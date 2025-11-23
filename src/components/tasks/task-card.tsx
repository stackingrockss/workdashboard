"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle } from "lucide-react";
import { formatDateShort } from "@/lib/format";
import { toast } from "sonner";
import type { TaskWithRelations } from "@/types/task";

interface TaskCardProps {
  task: TaskWithRelations;
  onComplete?: (taskId: string) => void;
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
 * - Color-coded due date badge
 * - Linked opportunity badge (if task is linked)
 * - Mark complete button
 * - Hover effect
 */
export function TaskCard({ task, onComplete }: TaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);

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
            {task.due && (
              <Badge
                variant={getDueDateVariant(task.due)}
                className="text-xs"
              >
                <Clock className="h-3 w-3 mr-1" />
                {formatDateShort(
                  typeof task.due === "string"
                    ? task.due
                    : task.due.toISOString()
                )}
              </Badge>
            )}

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
