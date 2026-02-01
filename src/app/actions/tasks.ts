'use server';

import { requireAuth } from '@/lib/firebase/server-auth';
import {
  getCollectionData,
  getDocumentData,
  createDocument,
  updateDocument,
  deleteDocument,
  queryCollection,
} from '@/lib/firebase/data-access';
import { ProjectId } from '@/lib/projects';
import { serializeForClient } from '@/lib/utils/serialize';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'completed';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  dueDate?: Date;
  completionDate?: Date;
  notes?: string;
  tags?: string[];
  order?: number; // For board view ordering
}

export async function getTasks(projectId: ProjectId, token?: string | null): Promise<Task[]> {
  await requireAuth(token);
  const tasks = await getCollectionData<Task>(projectId, 'tasks');
  
  // Recursively serialize all Date objects and non-serializable values
  return serializeForClient(tasks) as Task[];
}

export async function getTask(projectId: ProjectId, taskId: string, token?: string | null): Promise<Task | null> {
  await requireAuth(token);
  const task = await getDocumentData<Task>(projectId, 'tasks', taskId);
  if (!task) return null;
  
  // Recursively serialize all Date objects and non-serializable values
  return serializeForClient(task) as Task;
}

export async function createTask(
  projectId: ProjectId,
  data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  token?: string | null
): Promise<string> {
  const user = await requireAuth(token);
  
  const taskData = {
    ...data,
    createdBy: user.email || 'unknown',
  };
  
  return createDocument<Task>(projectId, 'tasks', taskData);
}

export async function updateTask(
  projectId: ProjectId,
  taskId: string,
  data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<Task>(projectId, 'tasks', taskId, data);
}

export async function deleteTask(projectId: ProjectId, taskId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'tasks', taskId);
}

export async function getTasksByStatus(
  projectId: ProjectId,
  status: Task['status'],
  token?: string | null
): Promise<Task[]> {
  await requireAuth(token);
  return queryCollection<Task>(projectId, 'tasks', (query) =>
    query.where('status', '==', status)
  );
}

export async function getTasksByPriority(
  projectId: ProjectId,
  priority: Task['priority'],
  token?: string | null
): Promise<Task[]> {
  await requireAuth(token);
  return queryCollection<Task>(projectId, 'tasks', (query) =>
    query.where('priority', '==', priority)
  );
}
