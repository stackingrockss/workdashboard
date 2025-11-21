// src/lib/integrations/google-tasks.ts
// Google Tasks API client for managing tasks and task lists

import { google } from 'googleapis';
import { getValidAccessToken } from './oauth-helpers';
import { prisma } from '@/lib/db';

export interface TaskListData {
  id: string;
  title: string;
}

export interface TaskData {
  id: string;
  title: string;
  notes?: string | null;
  due?: Date | null;
  status: 'needsAction' | 'completed';
  position: string;
  completed?: Date | null;
}

export interface CreateTaskInput {
  title: string;
  notes?: string;
  due?: Date;
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string;
  due?: Date | null;
  status?: 'needsAction' | 'completed';
}

export class GoogleTasksClient {
  /**
   * Creates an authenticated Google Tasks client for a user
   */
  private async getClient(userId: string) {
    const accessToken = await getValidAccessToken(userId, 'google');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    return google.tasks({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Lists all task lists for a user
   */
  async listTaskLists(userId: string): Promise<TaskListData[]> {
    try {
      const tasks = await this.getClient(userId);

      const response = await tasks.tasklists.list({
        maxResults: 100, // Google Tasks API limit
      });

      if (!response.data.items) {
        return [];
      }

      return response.data.items
        .filter((list) => list.id && list.title)
        .map((list) => ({
          id: list.id!,
          title: list.title!,
        }));
    } catch (error) {
      console.error('Failed to list task lists:', error);
      throw new Error('Failed to fetch task lists');
    }
  }

  /**
   * Creates a new task list
   */
  async createTaskList(userId: string, title: string): Promise<TaskListData> {
    try {
      const tasks = await this.getClient(userId);

      const response = await tasks.tasklists.insert({
        requestBody: {
          title,
        },
      });

      if (!response.data.id || !response.data.title) {
        throw new Error('Invalid response from Google Tasks API');
      }

      return {
        id: response.data.id,
        title: response.data.title,
      };
    } catch (error) {
      console.error('Failed to create task list:', error);
      throw new Error('Failed to create task list');
    }
  }

  /**
   * Updates a task list
   */
  async updateTaskList(
    userId: string,
    listId: string,
    title: string
  ): Promise<TaskListData> {
    try {
      const tasks = await this.getClient(userId);

      const response = await tasks.tasklists.update({
        tasklist: listId,
        requestBody: {
          id: listId,
          title,
        },
      });

      if (!response.data.id || !response.data.title) {
        throw new Error('Invalid response from Google Tasks API');
      }

      return {
        id: response.data.id,
        title: response.data.title,
      };
    } catch (error) {
      console.error('Failed to update task list:', error);
      throw new Error('Failed to update task list');
    }
  }

  /**
   * Deletes a task list
   */
  async deleteTaskList(userId: string, listId: string): Promise<void> {
    try {
      const tasks = await this.getClient(userId);

      await tasks.tasklists.delete({
        tasklist: listId,
      });
    } catch (error) {
      console.error('Failed to delete task list:', error);
      throw new Error('Failed to delete task list');
    }
  }

  /**
   * Lists tasks in a task list
   */
  async listTasks(
    userId: string,
    listId: string,
    options?: {
      showCompleted?: boolean;
      showHidden?: boolean;
      maxResults?: number;
      pageToken?: string;
    }
  ): Promise<{
    tasks: TaskData[];
    nextPageToken?: string;
  }> {
    try {
      const tasks = await this.getClient(userId);

      const response = await tasks.tasks.list({
        tasklist: listId,
        showCompleted: options?.showCompleted ?? true,
        showHidden: options?.showHidden ?? false,
        maxResults: options?.maxResults ?? 100,
        pageToken: options?.pageToken,
      });

      if (!response.data.items) {
        return {
          tasks: [],
          nextPageToken: undefined,
        };
      }

      const taskData = response.data.items
        .filter((task) => task.id && task.title)
        .map((task) => ({
          id: task.id!,
          title: task.title!,
          notes: task.notes || null,
          due: task.due ? new Date(task.due) : null,
          status:
            task.status === 'completed'
              ? ('completed' as const)
              : ('needsAction' as const),
          position: task.position || '0',
          completed: task.completed ? new Date(task.completed) : null,
        }));

      return {
        tasks: taskData,
        nextPageToken: response.data.nextPageToken || undefined,
      };
    } catch (error) {
      console.error('Failed to list tasks:', error);
      throw new Error('Failed to fetch tasks');
    }
  }

  /**
   * Gets a single task
   */
  async getTask(
    userId: string,
    listId: string,
    taskId: string
  ): Promise<TaskData | null> {
    try {
      const tasks = await this.getClient(userId);

      const response = await tasks.tasks.get({
        tasklist: listId,
        task: taskId,
      });

      const task = response.data;

      if (!task.id || !task.title) {
        return null;
      }

      return {
        id: task.id,
        title: task.title,
        notes: task.notes || null,
        due: task.due ? new Date(task.due) : null,
        status:
          task.status === 'completed'
            ? ('completed' as const)
            : ('needsAction' as const),
        position: task.position || '0',
        completed: task.completed ? new Date(task.completed) : null,
      };
    } catch (error) {
      console.error('Failed to get task:', error);
      return null;
    }
  }

  /**
   * Creates a new task
   */
  async createTask(
    userId: string,
    listId: string,
    taskData: CreateTaskInput
  ): Promise<TaskData> {
    try {
      const tasks = await this.getClient(userId);

      const response = await tasks.tasks.insert({
        tasklist: listId,
        requestBody: {
          title: taskData.title,
          notes: taskData.notes,
          due: taskData.due ? taskData.due.toISOString() : undefined,
        },
      });

      const task = response.data;

      if (!task.id || !task.title) {
        throw new Error('Invalid response from Google Tasks API');
      }

      return {
        id: task.id,
        title: task.title,
        notes: task.notes || null,
        due: task.due ? new Date(task.due) : null,
        status:
          task.status === 'completed'
            ? ('completed' as const)
            : ('needsAction' as const),
        position: task.position || '0',
        completed: task.completed ? new Date(task.completed) : null,
      };
    } catch (error) {
      console.error('Failed to create task:', error);
      throw new Error('Failed to create task');
    }
  }

  /**
   * Updates a task
   */
  async updateTask(
    userId: string,
    listId: string,
    taskId: string,
    updates: UpdateTaskInput
  ): Promise<TaskData> {
    try {
      const tasks = await this.getClient(userId);

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        id: taskId,
      };

      if (updates.title !== undefined) {
        updatePayload.title = updates.title;
      }
      if (updates.notes !== undefined) {
        updatePayload.notes = updates.notes;
      }
      if (updates.due !== undefined) {
        updatePayload.due = updates.due
          ? updates.due.toISOString()
          : null;
      }
      if (updates.status !== undefined) {
        updatePayload.status = updates.status;
      }

      const response = await tasks.tasks.update({
        tasklist: listId,
        task: taskId,
        requestBody: updatePayload,
      });

      const task = response.data;

      if (!task.id || !task.title) {
        throw new Error('Invalid response from Google Tasks API');
      }

      return {
        id: task.id,
        title: task.title,
        notes: task.notes || null,
        due: task.due ? new Date(task.due) : null,
        status:
          task.status === 'completed'
            ? ('completed' as const)
            : ('needsAction' as const),
        position: task.position || '0',
        completed: task.completed ? new Date(task.completed) : null,
      };
    } catch (error) {
      console.error('Failed to update task:', error);
      throw new Error('Failed to update task');
    }
  }

  /**
   * Marks a task as complete
   */
  async completeTask(
    userId: string,
    listId: string,
    taskId: string
  ): Promise<TaskData> {
    return this.updateTask(userId, listId, taskId, {
      status: 'completed',
    });
  }

  /**
   * Deletes a task
   */
  async deleteTask(
    userId: string,
    listId: string,
    taskId: string
  ): Promise<void> {
    try {
      const tasks = await this.getClient(userId);

      await tasks.tasks.delete({
        tasklist: listId,
        task: taskId,
      });
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw new Error('Failed to delete task');
    }
  }
}

// Export a singleton instance
export const googleTasksClient = new GoogleTasksClient();
