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
import { ListTodo, Settings, AlertCircle, Calendar } from "lucide-react";
import { TaskCard } from "./task-card";
import type { TaskWithRelations } from "@/types/task";

/**
 * Groups tasks by timeframe relative to today
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
    if (!task.due) return; // Skip tasks without due dates

    const dueDate = new Date(task.due);
    dueDate.setHours(0, 0, 0, 0);

    let label: string;
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

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(task);
  });

  return groups;
}

/**
 * UpcomingTasksWidget - Dashboard widget showing upcoming Google Tasks
 *
 * Features:
 * - Shows tasks due in next 7 days
 * - Groups by timeframe (Overdue, Today, Tomorrow, This Week)
 * - Limits to 10 most urgent tasks
 * - Quick mark complete action
 * - Links to linked opportunities
 * - Auto-refreshes every 5 minutes
 */
export function UpcomingTasksWidget() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [notConnected, setNotConnected] = useState(false);

  const loadUpcomingTasks = async () => {
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

      // Calculate date range (next 7 days)
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Fetch tasks from all lists in parallel
      const allTasks: TaskWithRelations[] = [];

      await Promise.all(
        taskLists.map(async (list: { id: string }) => {
          try {
            const tasksResponse = await fetch(
              `/api/v1/tasks/lists/${list.id}/tasks?status=needsAction&dueBefore=${sevenDaysFromNow.toISOString()}`
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

      // Filter tasks with due dates and sort by due date
      const sortedTasks = allTasks
        .filter((task) => task.due)
        .sort((a, b) => {
          const dateA = new Date(a.due!).getTime();
          const dateB = new Date(b.due!).getTime();
          return dateA - dateB;
        })
        .slice(0, 10); // Limit to 10 tasks

      setTasks(sortedTasks);
    } catch (err) {
      console.error("Failed to load upcoming tasks:", err);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUpcomingTasks();

    // Auto-refresh every 5 minutes
    const interval = setInterval(loadUpcomingTasks, 5 * 60 * 1000);

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
  const groupOrder = ["Overdue", "Today", "Tomorrow", "This Week", "Later"];

  return (
    <Card className="col-span-full md:col-span-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            <CardTitle>Upcoming Tasks</CardTitle>
          </div>
          <Link href="/settings/integrations">
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          Tasks due in the next 7 days from Google Tasks
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
                Connect your Google Tasks to view upcoming tasks alongside your
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
            <Button onClick={loadUpcomingTasks} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !notConnected && !error && tasks.length === 0 && (
          <div className="text-center py-8">
            <CardDescription className="mb-2">
              You have no upcoming tasks in the next 7 days.
            </CardDescription>
            <p className="text-sm text-muted-foreground">
              Tasks will appear here when you have items due soon in Google
              Tasks.
            </p>
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
