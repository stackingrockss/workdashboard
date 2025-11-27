import type { TaskWithRelations } from "@/types/task";

export type TaskFilterPreference =
  | 'thisWeekOrNoDueDate'
  | 'thisWeek'
  | 'all'
  | 'overdue';

/**
 * Get week bounds (Sunday to Saturday)
 * Sunday is day 0
 */
export function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);

  // Get days since Sunday (0 = Sunday)
  const daysSinceSunday = today.getDay();

  // Calculate week start (Sunday)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysSinceSunday);

  // Calculate week end (Saturday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { start: weekStart, end: weekEnd };
}

/**
 * Check if a date is within this week
 */
export function isThisWeek(date: Date): boolean {
  const { start, end } = getWeekBounds();
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate >= start && checkDate <= end;
}

/**
 * Check if a date is overdue (before today)
 */
export function isOverdue(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate < today;
}

/**
 * Filter tasks based on user preference
 */
export function filterTasksByPreference(
  tasks: TaskWithRelations[],
  preference: TaskFilterPreference
): TaskWithRelations[] {
  return tasks.filter(task => {
    // Always exclude completed tasks
    if (task.status === 'completed') return false;

    switch (preference) {
      case 'thisWeekOrNoDueDate':
        // Default: show tasks due this week or with no due date
        if (!task.due) return true;
        return isThisWeek(new Date(task.due));

      case 'thisWeek':
        // Only this week, exclude no due date
        if (!task.due) return false;
        return isThisWeek(new Date(task.due));

      case 'overdue':
        // Only overdue tasks
        if (!task.due) return false;
        return isOverdue(new Date(task.due));

      case 'all':
        // All pending tasks
        return true;

      default:
        return true;
    }
  });
}

/**
 * Get human-readable label for filter preference
 */
export function getFilterLabel(preference: TaskFilterPreference): string {
  switch (preference) {
    case 'thisWeekOrNoDueDate':
      return 'This Week or No Due Date';
    case 'thisWeek':
      return 'This Week Only';
    case 'overdue':
      return 'Overdue';
    case 'all':
      return 'All Tasks';
    default:
      return 'All Tasks';
  }
}
