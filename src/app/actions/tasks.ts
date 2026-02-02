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
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  const taskData = {
    ...data,
    createdBy: user.email || 'unknown',
  };
  
  const taskId = await createDocument<Task>(projectId, 'tasks', taskData);
  
  // Send email if task is created with an assignee
  if (shouldSendEmails && taskData.assignedTo && taskData.assignedTo.trim() && taskData.assignedTo.includes('@')) {
    try {
      console.log(`[Task Email] Sending assignment email for new task ${taskId}:`, {
        assignedTo: taskData.assignedTo,
        title: taskData.title,
      });
      
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
      const projectName = project?.displayName || projectId;
      let emailBody = `Hello,\n\n`;
      emailBody += `Project: ${projectName}\n\n`;
      emailBody += `You have been assigned to a new task.\n\n`;
      emailBody += `Task: ${taskData.title || 'Untitled Task'}\n`;
      emailBody += `Description: ${taskData.description || 'No description'}\n\n`;
      emailBody += `Status: ${statusLabels[taskData.status || 'todo']}\n`;
      emailBody += `Priority: ${priorityLabels[taskData.priority || 'medium']}\n`;
      
      if (taskData.dueDate) {
        emailBody += `Due date: ${format(new Date(taskData.dueDate), 'MMM d, yyyy')}\n`;
      }
      
      emailBody += `\n---\n`;
      emailBody += `View this task in the admin panel for more details.\n`;
      
      const subject = `[${projectName}] You've been assigned to: ${taskData.title || 'Task'}`;
      
      await sendTaskUpdateEmail(projectId, taskId, subject, emailBody, taskData.assignedTo, token);
      console.log(`[Task Email] Email sent successfully to ${taskData.assignedTo}`);
    } catch (error) {
      // Log error but don't fail the creation
      console.error('[Task Email] Failed to send assignment email for new task:', error);
      console.error('[Task Email] Error details:', {
        taskId,
        assignedTo: taskData.assignedTo,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      // Re-throw in development to help debug
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    }
  } else if (shouldSendEmails && taskData.assignedTo) {
    console.warn('[Task Email] Task created with assignee but email not sent:', {
      taskId,
      assignedTo: taskData.assignedTo,
      reason: !taskData.assignedTo.trim() ? 'Empty assignee' : !taskData.assignedTo.includes('@') ? 'Invalid email format' : 'Unknown',
    });
  }
  
  return taskId;
}

export async function updateTask(
  projectId: ProjectId,
  taskId: string,
  data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  if (shouldSendEmails) {
    // Get previous data to detect changes
    const previousData = await getDocumentData<Task>(projectId, 'tasks', taskId);
    
    // Detect key changes
    const changes: string[] = [];
    const newAssignedTo = data.assignedTo !== undefined ? (data.assignedTo || null) : (previousData?.assignedTo || null);
    const oldAssignedTo = previousData?.assignedTo || null;
    
    // Normalize to handle empty strings vs null vs undefined
    const normalizedNewAssignedTo = newAssignedTo && newAssignedTo.trim() ? newAssignedTo.trim() : null;
    const normalizedOldAssignedTo = oldAssignedTo && oldAssignedTo.trim() ? oldAssignedTo.trim() : null;
    
    if (data.assignedTo !== undefined && normalizedNewAssignedTo !== normalizedOldAssignedTo) {
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
    
    // Send email if there are changes
    // Handle different scenarios:
    // 1. Unassignment - send to old assignee
    // 2. Assignment/reassignment - send to new assignee
    // 3. Status to completed - send to creator
    // 4. Other changes - send to current assignee
    if (changes.length > 0) {
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
      
      // Helper function to get creator email
      const getCreatorEmail = (): string | null => {
        // Check if task has email in createdBy
        if (previousData?.createdBy && previousData.createdBy.includes('@')) {
          return previousData.createdBy;
        }
        return null;
      };
      
      // Scenario 1: Unassignment - send to old assignee
      if (changes.includes('assignment') && normalizedOldAssignedTo && !normalizedNewAssignedTo) {
        try {
          console.log(`[Task Email] Sending unassignment email for task ${taskId}:`, {
            oldAssignee: normalizedOldAssignedTo,
          });
          
          const projectName = project?.displayName || projectId;
          let emailBody = `Hello,\n\n`;
          emailBody += `Project: ${projectName}\n\n`;
          emailBody += `You have been unassigned from this task.\n\n`;
          emailBody += `Task: ${previousData?.title || 'Untitled Task'}\n`;
          emailBody += `Description: ${previousData?.description || 'No description'}\n\n`;
          emailBody += `Status: ${statusLabels[previousData?.status || 'todo']}\n`;
          emailBody += `Priority: ${priorityLabels[previousData?.priority || 'medium']}\n`;
          emailBody += `\n---\n`;
          emailBody += `You are no longer responsible for this task.\n`;
          
          const subject = `[${projectName}] Unassigned from: ${previousData?.title || 'Task'}`;
          
          await sendTaskUpdateEmail(projectId, taskId, subject, emailBody, normalizedOldAssignedTo, token);
          console.log(`[Task Email] Unassignment email sent successfully to ${normalizedOldAssignedTo}`);
        } catch (error) {
          console.error('[Task Email] Failed to send unassignment email:', error);
          if (process.env.NODE_ENV === 'development') {
            throw error;
          }
        }
      }
      
      // Scenario 2: Status changed to completed - send to creator
      if (changes.includes('status') && data.status === 'completed') {
        try {
          const creatorEmail = getCreatorEmail();
          
          if (creatorEmail && creatorEmail.includes('@')) {
            console.log(`[Task Email] Sending completion email for task ${taskId}:`, {
              status: data.status,
              creatorEmail,
            });
            
            const projectName = project?.displayName || projectId;
            let emailBody = `Hello,\n\n`;
            emailBody += `Project: ${projectName}\n\n`;
            emailBody += `Great news! The task you created has been completed.\n\n`;
            emailBody += `Task: ${previousData?.title || 'Untitled Task'}\n`;
            emailBody += `Description: ${previousData?.description || 'No description'}\n\n`;
            emailBody += `Status: ${statusLabels[data.status as string]}\n`;
            emailBody += `Priority: ${priorityLabels[previousData?.priority || 'medium']}\n`;
            
            // Use updated completion date if provided, otherwise use previous
            const completionDate = data.completionDate || previousData?.completionDate;
            if (completionDate) {
              emailBody += `Completed: ${format(new Date(completionDate), 'MMM d, yyyy')}\n`;
            }
            
            emailBody += `\n---\n`;
            emailBody += `Thank you for creating this task. If you have any questions or concerns, please reply to this email.\n`;
            
            const subject = `[${projectName}] Task Completed: ${previousData?.title || 'Task'}`;
            
            await sendTaskUpdateEmail(projectId, taskId, subject, emailBody, creatorEmail, token);
            console.log(`[Task Email] Completion email sent successfully to ${creatorEmail}`);
          } else {
            console.log('[Task Email] Status changed to completed but no creator email found:', {
              taskId,
              creatorEmail,
            });
          }
        } catch (error) {
          console.error('[Task Email] Failed to send completion email:', error);
          if (process.env.NODE_ENV === 'development') {
            throw error;
          }
        }
      }
      
      // Scenario 3: Assignment/reassignment or other changes - send to assignee
      // Only send if there's a current assignee and it's not an unassignment (already handled above)
      if (!(changes.includes('assignment') && normalizedOldAssignedTo && !normalizedNewAssignedTo)) {
        let emailRecipient: string | null = null;
        
        if (changes.includes('assignment')) {
          // If assignment changed, send to the new assignee
          emailRecipient = normalizedNewAssignedTo;
        } else {
          // For other changes, send to the current assignee
          emailRecipient = normalizedNewAssignedTo;
        }
        
        // Only send email if there's a recipient
        if (emailRecipient && emailRecipient.includes('@')) {
          console.log(`[Task Email] Sending email for task ${taskId}:`, {
            changes,
            emailRecipient,
            normalizedNewAssignedTo,
            normalizedOldAssignedTo,
          });
          try {
            // Build email body
            const projectName = project?.displayName || projectId;
            let emailBody = `Hello,\n\n`;
            emailBody += `Project: ${projectName}\n\n`;
            
            if (changes.includes('assignment')) {
              if (normalizedOldAssignedTo) {
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
            
            const subject = changes.includes('assignment') && !normalizedOldAssignedTo
              ? `[${projectName}] You've been assigned to: ${previousData?.title || 'Task'}`
              : `[${projectName}] Update: ${previousData?.title || 'Task'}`;
            
            await sendTaskUpdateEmail(projectId, taskId, subject, emailBody, emailRecipient, token);
            console.log(`[Task Email] Email sent successfully to ${emailRecipient}`);
          } catch (error) {
            // Log error but don't fail the update
            console.error('[Task Email] Failed to send task update email:', error);
            console.error('[Task Email] Error details:', {
              taskId,
              emailRecipient,
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
            });
            // Re-throw in development to help debug
            if (process.env.NODE_ENV === 'development') {
              throw error;
            }
          }
        } else if (changes.includes('assignment')) {
          // Log warning if assignment changed but no recipient
          console.warn('[Task Email] Assignment change detected but no assignee email found:', {
            taskId,
            changes,
            normalizedNewAssignedTo,
            normalizedOldAssignedTo,
            dataAssignedTo: data.assignedTo,
            previousDataAssignedTo: previousData?.assignedTo,
          });
        }
      }
    }
  }
  
  return updateDocument<Task>(projectId, 'tasks', taskId, data);
}

export async function deleteTask(projectId: ProjectId, taskId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  // Get task data before deleting (for email notification)
  let taskData: Task | null = null;
  if (shouldSendEmails) {
    taskData = await getDocumentData<Task>(projectId, 'tasks', taskId);
  }
  
  // Delete the task
  await deleteDocument(projectId, 'tasks', taskId);
  
  // Send email notification if task had an assignee
  if (shouldSendEmails && taskData && taskData.assignedTo && taskData.assignedTo.trim() && taskData.assignedTo.includes('@')) {
    try {
      console.log(`[Task Email] Sending deletion email for task ${taskId}:`, {
        assignedTo: taskData.assignedTo,
        title: taskData.title,
      });
      
      const projectName = project?.displayName || projectId;
      const emailBody = `Hello,\n\n` +
        `Project: ${projectName}\n\n` +
        `The task you were assigned to has been deleted.\n\n` +
        `Task: ${taskData.title || 'Untitled Task'}\n` +
        `Description: ${taskData.description || 'No description'}\n\n` +
        `---\n` +
        `This task has been removed from the system. If you have any questions, please contact the team.\n`;
      
      const subject = `[${projectName}] Task Deleted: ${taskData.title || 'Task'}`;
      
      await sendTaskUpdateEmail(projectId, taskId, subject, emailBody, taskData.assignedTo, token);
      console.log(`[Task Email] Deletion email sent successfully to ${taskData.assignedTo}`);
    } catch (error) {
      // Log error but don't fail the deletion
      console.error('[Task Email] Failed to send deletion email:', error);
      console.error('[Task Email] Error details:', {
        taskId,
        assignedTo: taskData.assignedTo,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      // Re-throw in development to help debug
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    }
  }
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
  const { getFirebaseFunctionUrl } = await import('@/lib/firebase-function-urls');
  const functionUrl = getFirebaseFunctionUrl(projectId, 'sendIssueUpdateEmail');
  
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
