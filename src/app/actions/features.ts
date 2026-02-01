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

export interface Feature {
  id: string;
  title: string;
  description: string;
  area: 'learner' | 'admin' | 'content' | 'ops';
  priority: 'high' | 'medium' | 'low';
  status: 'idea' | 'planned' | 'in_development' | 'released';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  assignedTo?: string; // Email address of assigned user
  order?: number; // For board view ordering
  dueDate?: Date; // Target completion date
  completionDate?: Date; // Actual completion date
}

export async function getFeatures(projectId: ProjectId, token?: string | null): Promise<Feature[]> {
  await requireAuth(token);
  const features = await getCollectionData<Feature>(projectId, 'features');
  
  // Recursively serialize all Date objects and non-serializable values
  return serializeForClient(features) as Feature[];
}

export async function getFeature(projectId: ProjectId, featureId: string, token?: string | null): Promise<Feature | null> {
  await requireAuth(token);
  const feature = await getDocumentData<Feature>(projectId, 'features', featureId);
  if (!feature) return null;
  
  // Recursively serialize all Date objects and non-serializable values
  return serializeForClient(feature) as Feature;
}

export async function createFeature(
  projectId: ProjectId,
  data: Omit<Feature, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
  token?: string | null
): Promise<string> {
  const user = await requireAuth(token);
  
  const featureData = {
    ...data,
    createdBy: user.email || 'unknown',
  };
  
  return createDocument<Feature>(projectId, 'features', featureData);
}

export async function updateFeature(
  projectId: ProjectId,
  featureId: string,
  data: Partial<Omit<Feature, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter-uae
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae';
  
  if (shouldSendEmails) {
    // Get previous data to detect changes
    const previousData = await getDocumentData<Feature>(projectId, 'features', featureId);
    
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
          idea: 'Idea',
          planned: 'Planned',
          in_development: 'In Development',
          released: 'Released',
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
            emailBody += `You have been reassigned to this feature.\n\n`;
          } else {
            emailBody += `You have been assigned to this feature.\n\n`;
          }
        }
        
        emailBody += `Feature: ${previousData?.title || 'Untitled Feature'}\n`;
        emailBody += `Description: ${previousData?.description || 'No description'}\n\n`;
        
        if (changes.includes('status')) {
          emailBody += `Status changed to: ${statusLabels[data.status as string] || data.status}\n`;
        } else {
          emailBody += `Status: ${statusLabels[previousData?.status || 'idea']}\n`;
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
        emailBody += `View this feature in the admin panel for more details.\n`;
        
        const subject = changes.includes('assignment') && !oldAssignedTo
          ? `You've been assigned to: ${previousData?.title || 'Feature'}`
          : `Update: ${previousData?.title || 'Feature'}`;
        
        await sendFeatureUpdateEmail(projectId, featureId, subject, emailBody, newAssignedTo, token);
      } catch (error) {
        // Log error but don't fail the update
        console.error('Failed to send feature update email:', error);
      }
    }
  }
  
  return updateDocument<Feature>(projectId, 'features', featureId, data);
}

export async function deleteFeature(projectId: ProjectId, featureId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'features', featureId);
}

export async function getFeaturesByStatus(
  projectId: ProjectId,
  status: Feature['status'],
  token?: string | null
): Promise<Feature[]> {
  await requireAuth(token);
  return queryCollection<Feature>(projectId, 'features', (query) =>
    query.where('status', '==', status)
  );
}

export async function getFeaturesByArea(
  projectId: ProjectId,
  area: Feature['area'],
  token?: string | null
): Promise<Feature[]> {
  await requireAuth(token);
  return queryCollection<Feature>(projectId, 'features', (query) =>
    query.where('area', '==', area)
  );
}

/**
 * Send an email update to the assigned user
 * Calls Firebase Cloud Function to send email
 */
export async function sendFeatureUpdateEmail(
  projectId: ProjectId,
  featureId: string,
  subject: string,
  body: string,
  assignedToEmail: string,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Get the feature
  const feature = await getDocumentData<Feature>(projectId, 'features', featureId);
  if (!feature) {
    throw new Error(`Feature ${featureId} not found`);
  }
  
  if (!assignedToEmail) {
    throw new Error('No assigned user email found for this feature');
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
      issueId: featureId,
      issueSubject: feature.title || 'Feature',
    }),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Failed to send email');
  }
}
