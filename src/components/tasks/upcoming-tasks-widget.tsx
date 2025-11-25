"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ListTodo, Settings, AlertCircle, Calendar, RefreshCw } from "lucide-react";
import { TaskCard } from "./task-card";
import { toast } from "sonner";
import type { TaskWithRelations } from "@/types/task";

/**
 * Groups tasks by timeframe relative to today
 * Tasks without due dates go into "No Due Date" group
 */
function groupTasksByTimeframe(
  tasks: TaskWithRelations[]
): Record<string, TaskWithRelations[]> {
  const groups: Record<string, TaskWithRelations[]> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  tasks.forEach((task) => {
    let label: string;

    if (!task.due) {
      label = "No Due Date";
    } else {
      const dueDate = new Date(task.due);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        label = "Overdue";
      } else if (dueDate.getTime() === today.getTime()) {
        label = "Today";
      } else if (dueDate.getTime() === tomorrow.getTime()) {
        label = "Tomorrow";
      } else if (dueDate <= nextWeek) {
        label = "This Week";
      } else {
        label = "Later";
      }
    }

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(task);
  });

  return groups;
}

/**
 * UpcomingTasksWidget - Dashboard widget showing Google Tasks
 *
 * Features:
 * - Shows all pending tasks from Google Tasks
 * - Groups by timeframe (Overdue, Today, Tomorrow, This Week, Later, No Due Date)
 * - Limits to 15 tasks
 * - Quick mark complete action
 * - Links to linked opportunities
 * - Manual sync button
 * - Auto-refreshes every 5 minutes
 */
export function UpcomingTasksWidget() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [notConnected, setNotConnected] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    setNotConnected(false);

    try {
      // Fetch all task lists
      const listsResponse = await fetch("/api/v1/tasks/lists");

      if (listsResponse.status === 400 || listsResponse.status === 403) {
        const data = await listsResponse.json();
        if (
          data.error?.includes("not connected") ||
          data.error?.includes("not granted")
        ) {
          setNotConnected(true);
          setLoading(false);
          return;
        }
      }

      if (!listsResponse.ok) {
        throw new Error("Failed to fetch task lists");
      }

      const listsData = await listsResponse.json();
      const taskLists = listsData.taskLists || [];

      if (taskLists.length === 0) {
        setTasks([]);
        setLoading(false);
        return;
      }

      // Fetch tasks from all lists in parallel (no date filter, all pending tasks)
      const allTasks: TaskWithRelations[] = [];

      await Promise.all(
        taskLists.map(async (list: { id: string }) => {
          try {
            const tasksResponse = await fetch(
              `/api/v1/tasks/lists/${list.id}/tasks?status=needsAction`
            );

            if (tasksResponse.ok) {
              const tasksData = await tasksResponse.json();
              allTasks.push(...(tasksData.tasks || []));
            }
          } catch (err) {
            console.error(`Failed to fetch tasks for list ${list.id}:`, err);
            // Continue with other lists
          }
        })
      );

      // Sort tasks: overdue first, then by due date, then tasks without due dates
      const sortedTasks = allTasks
        .sort((a, b) => {
          // Tasks with due dates come before tasks without
          if (a.due && !b.due) return -1;
          if (!a.due && b.due) return 1;
          if (!a.due && !b.due) return 0;

          // Both have due dates - sort by date
          const dateA = new Date(a.due!).getTime();
          const dateB = new Date(b.due!).getTime();
          return dateA - dateB;
        })
        .slice(0, 15); // Limit to 15 tasks

      setTasks(sortedTasks);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/v1/integrations/google/tasks/sync", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sync");
      }

      const data = await response.json();
      toast.success(
        `Synced ${data.stats.tasksSynced} tasks from ${data.stats.listsSynced} lists`
      );

      // Reload tasks after sync
      await loadTasks();
    } catch (err) {
      console.error("Failed to sync tasks:", err);
      toast.error(err instanceof Error ? err.message : "Failed to sync tasks");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadTasks();

    // Auto-refresh every 5 minutes
    const interval = setInterval(loadTasks, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleTaskComplete = (taskId: string) => {
    // Optimistically remove from UI
    setTasks((prevTasks) => prevTasks.filter((t) => t.id !== taskId));
  };

  // Group tasks by timeframe
  const groupedTasks = useMemo(
    () => groupTasksByTimeframe(tasks),
    [tasks]
  );

  // Define display order for timeframe groups
  const groupOrder = ["Overdue", "Today", "Tomorrow", "This Week", "Later", "No Due Date"];

  return (
    <Card className="col-span-full md:col-span-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            <CardTitle>Tasks</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSync}
              disabled={syncing || notConnected}
              title="Sync from Google Tasks"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            </Button>
            <Link href="/settings/integrations">
              <Button variant="ghost" size="icon" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <CardDescription>
          Your pending tasks from Google Tasks
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {/* Not connected state */}
        {!loading && notConnected && (
          <div className="space-y-4">
            <Alert>
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                Connect your Google Tasks to view tasks alongside your
                opportunities.
              </AlertDescription>
            </Alert>
            <Link href="/settings/integrations">
              <Button className="w-full">Connect Google Tasks</Button>
            </Link>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={loadTasks} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !notConnected && !error && tasks.length === 0 && (
          <div className="text-center py-8">
            <CardDescription className="mb-4">
              No pending tasks found.
            </CardDescription>
            <Button onClick={handleSync} variant="outline" disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync from Google Tasks"}
            </Button>
          </div>
        )}

        {/* Success state - grouped tasks */}
        {!loading && !notConnected && !error && tasks.length > 0 && (
          <div className="space-y-4">
            {groupOrder.map((groupLabel) => {
              const groupTasks = groupedTasks[groupLabel];
              if (!groupTasks || groupTasks.length === 0) return null;

              return (
                <div key={groupLabel} className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    {groupLabel}
                  </h3>
                  <div className="space-y-2">
                    {groupTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={handleTaskComplete}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
