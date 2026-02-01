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
import { ProjectId, getProject } from '@/lib/projects';
import { serializeForClient } from '@/lib/utils/serialize';
import { format } from 'date-fns';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'completed';
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  assignedTo?: string; // Email address of assigned user
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
  
  // Only send emails for prepcenter-uae
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae';
  
  if (shouldSendEmails) {
    // Get previous data to detect changes
    const previousData = await getDocumentData<Task>(projectId, 'tasks', taskId);
    
    // Detect key changes
    const changes: string[] = [];
    const newAssignedTo = data.assignedTo !== undefined ? data.assignedTo : previousData?.assignedTo;
    const oldAssignedTo = previousData?.assignedTo;
    
    if (data.assignedTo !== undefined && data.assignedTo !== oldAssignedTo) {
      changes.push('assignment');
    }
    if (data.status !== undefined && data.status !== previousData?.status) {
      changes.push('status');
    }
    if (data.priority !== undefined && data.priority !== previousData?.priority) {
      changes.push('priority');
    }
    if (data.dueDate !== undefined) {
      const newDueDate = data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : null;
      const oldDueDate = previousData?.dueDate ? new Date(previousData.dueDate).toISOString().split('T')[0] : null;
      if (newDueDate !== oldDueDate) {
        changes.push('dueDate');
      }
    }
    
    // Send email if there are changes and there's an assignee
    if (changes.length > 0 && newAssignedTo) {
      try {
        const statusLabels: Record<string, string> = {
          todo: 'Todo',
          in_progress: 'In Progress',
          blocked: 'Blocked',
          completed: 'Completed',
        };
        
        const priorityLabels: Record<string, string> = {
          high: 'High',
          medium: 'Medium',
          low: 'Low',
        };
        
        // Build email body
        let emailBody = `Hello,\n\n`;
        
        if (changes.includes('assignment')) {
          if (oldAssignedTo) {
            emailBody += `You have been reassigned to this task.\n\n`;
          } else {
            emailBody += `You have been assigned to this task.\n\n`;
          }
        }
        
        emailBody += `Task: ${previousData?.title || 'Untitled Task'}\n`;
        emailBody += `Description: ${previousData?.description || 'No description'}\n\n`;
        
        if (changes.includes('status')) {
          emailBody += `Status changed to: ${statusLabels[data.status as string] || data.status}\n`;
        } else {
          emailBody += `Status: ${statusLabels[previousData?.status || 'todo']}\n`;
        }
        
        if (changes.includes('priority')) {
          emailBody += `Priority changed to: ${priorityLabels[data.priority as string] || data.priority}\n`;
        } else {
          emailBody += `Priority: ${priorityLabels[previousData?.priority || 'medium']}\n`;
        }
        
        if (changes.includes('dueDate')) {
          if (data.dueDate) {
            emailBody += `Due date changed to: ${format(new Date(data.dueDate), 'MMM d, yyyy')}\n`;
          } else {
            emailBody += `Due date removed\n`;
          }
        } else if (previousData?.dueDate) {
          emailBody += `Due date: ${format(new Date(previousData.dueDate), 'MMM d, yyyy')}\n`;
        }
        
        emailBody += `\n---\n`;
        emailBody += `View this task in the admin panel for more details.\n`;
        
        const subject = changes.includes('assignment') && !oldAssignedTo
          ? `You've been assigned to: ${previousData?.title || 'Task'}`
          : `Update: ${previousData?.title || 'Task'}`;
        
        await sendTaskUpdateEmail(projectId, taskId, subject, emailBody, newAssignedTo, token);
      } catch (error) {
        // Log error but don't fail the update
        console.error('Failed to send task update email:', error);
      }
    }
  }
  
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

/**
 * Send an email update to the assigned user
 * Calls Firebase Cloud Function to send email
 */
export async function sendTaskUpdateEmail(
  projectId: ProjectId,
  taskId: string,
  subject: string,
  body: string,
  assignedToEmail: string,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Get the task
  const task = await getDocumentData<Task>(projectId, 'tasks', taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  if (!assignedToEmail) {
    throw new Error('No assigned user email found for this task');
  }
  
  // Call Firebase Cloud Function to send email
  const functionUrl = `https://us-central1-prepcenter-750c1.cloudfunctions.net/sendIssueUpdateEmail`;
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: assignedToEmail,
      subject: subject,
      body: body,
      issueId: taskId,
      issueSubject: task.title || 'Task',
    }),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Failed to send email');
  }
}
