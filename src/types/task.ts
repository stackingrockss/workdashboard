// src/types/task.ts
// TypeScript types for Google Tasks integration

export interface TaskListData {
  id: string;
  googleListId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskData {
  id: string;
  taskListId: string;
  googleTaskId: string;
  title: string;
  notes?: string | null;
  due?: Date | null;
  status: 'needsAction' | 'completed';
  position: string;
  opportunityId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
}

export interface TaskWithRelations extends TaskData {
  taskList?: TaskListData;
  opportunity?: {
    id: string;
    name: string;
  };
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  due?: string; // ISO date string
  opportunityId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string;
  due?: string | null; // ISO date string or null to clear
  status?: 'needsAction' | 'completed';
  opportunityId?: string | null;
}

export interface TaskFilter {
  status?: 'needsAction' | 'completed' | 'all';
  opportunityId?: string;
  dueAfter?: string; // ISO date string
  dueBefore?: string; // ISO date string
}

export interface CreateTaskListInput {
  title: string;
}

export interface UpdateTaskListInput {
  title: string;
}
