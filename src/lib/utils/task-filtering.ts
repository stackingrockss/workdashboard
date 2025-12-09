import type { TaskWithRelations } from "@/types/task";

export type TaskFilterPreference =
  | 'today'
  | 'thisWeekOrNoDueDate'
  | 'noDueDate'
  | 'all';

/**
 * Parse a date value (string or Date) as a local date.
 * Handles ISO date strings like "2024-12-09T00:00:00.000Z" by extracting
 * just the date portion and creating a local date to avoid timezone shifting.
 */
export function parseAsLocalDate(value: string | Date): Date {
  if (value instanceof Date) {
    // If it's already a Date, extract the UTC date parts and create local date
    // This handles dates that were parsed from UTC strings
    return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  // Extract YYYY-MM-DD from ISO string
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  // Fallback to standard parsing
  return new Date(value);
}

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
export function isThisWeek(date: Date | string): boolean {
  const { start, end } = getWeekBounds();
  const checkDate = parseAsLocalDate(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate >= start && checkDate <= end;
}

/**
 * Check if a date is overdue (before today)
 */
export function isOverdue(date: Date | string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDate = parseAsLocalDate(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate < today;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDate = parseAsLocalDate(date);
  checkDate.setHours(0, 0, 0, 0);

  return checkDate.getTime() === today.getTime();
}

/**
 * Filter tasks based on user preference.
 *
 * Note: Overdue tasks are always included in ALL filter views to ensure
 * users never miss tasks that need attention, regardless of the selected filter.
 */
export function filterTasksByPreference(
  tasks: TaskWithRelations[],
  preference: TaskFilterPreference
): TaskWithRelations[] {
  return tasks.filter(task => {
    // Always exclude completed tasks
    if (task.status === 'completed') return false;

    // Always include overdue tasks in all views to ensure visibility
    if (task.due && isOverdue(task.due)) {
      return true;
    }

    switch (preference) {
      case 'today':
        // Tasks due today (overdue already included above)
        if (!task.due) return false;
        return isToday(task.due);

      case 'thisWeekOrNoDueDate':
        // Tasks due this week or with no due date
        if (!task.due) return true;
        return isThisWeek(task.due);

      case 'noDueDate':
        // Only tasks without a due date (overdue already included above)
        return !task.due;

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
    case 'today':
      return 'Today';
    case 'thisWeekOrNoDueDate':
      return 'This Week';
    case 'noDueDate':
      return 'No Due Date';
    case 'all':
      return 'All Tasks';
    default:
      return 'All Tasks';
  }
}
