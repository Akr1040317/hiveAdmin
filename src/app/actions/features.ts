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
  
  // Only send emails for prepcenter-uae
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae';
  
  const featureData = {
    ...data,
    createdBy: user.email || 'unknown',
  };
  
  const featureId = await createDocument<Feature>(projectId, 'features', featureData);
  
  // Send email if feature is created with an assignee
  if (shouldSendEmails && featureData.assignedTo && featureData.assignedTo.trim() && featureData.assignedTo.includes('@')) {
    try {
      console.log(`[Feature Email] Sending assignment email for new feature ${featureId}:`, {
        assignedTo: featureData.assignedTo,
        title: featureData.title,
      });
      
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
      emailBody += `You have been assigned to a new feature.\n\n`;
      emailBody += `Feature: ${featureData.title || 'Untitled Feature'}\n`;
      emailBody += `Description: ${featureData.description || 'No description'}\n\n`;
      emailBody += `Status: ${statusLabels[featureData.status || 'idea']}\n`;
      emailBody += `Priority: ${priorityLabels[featureData.priority || 'medium']}\n`;
      
      if (featureData.dueDate) {
        emailBody += `Due date: ${format(new Date(featureData.dueDate), 'MMM d, yyyy')}\n`;
      }
      
      emailBody += `\n---\n`;
      emailBody += `View this feature in the admin panel for more details.\n`;
      
      const subject = `You've been assigned to: ${featureData.title || 'Feature'}`;
      
      await sendFeatureUpdateEmail(projectId, featureId, subject, emailBody, featureData.assignedTo, token);
      console.log(`[Feature Email] Email sent successfully to ${featureData.assignedTo}`);
    } catch (error) {
      // Log error but don't fail the creation
      console.error('[Feature Email] Failed to send assignment email for new feature:', error);
      console.error('[Feature Email] Error details:', {
        featureId,
        assignedTo: featureData.assignedTo,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      // Re-throw in development to help debug
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    }
  } else if (shouldSendEmails && featureData.assignedTo) {
    console.warn('[Feature Email] Feature created with assignee but email not sent:', {
      featureId,
      assignedTo: featureData.assignedTo,
      reason: !featureData.assignedTo.trim() ? 'Empty assignee' : !featureData.assignedTo.includes('@') ? 'Invalid email format' : 'Unknown',
    });
  }
  
  return featureId;
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
    // 3. Status to released - send to creator
    // 4. Other changes - send to current assignee
    if (changes.length > 0) {
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
      
      // Helper function to get creator email
      const getCreatorEmail = (): string | null => {
        // Check if feature has email in createdBy
        if (previousData?.createdBy && previousData.createdBy.includes('@')) {
          return previousData.createdBy;
        }
        return null;
      };
      
      // Scenario 1: Unassignment - send to old assignee
      if (changes.includes('assignment') && normalizedOldAssignedTo && !normalizedNewAssignedTo) {
        try {
          console.log(`[Feature Email] Sending unassignment email for feature ${featureId}:`, {
            oldAssignee: normalizedOldAssignedTo,
          });
          
          let emailBody = `Hello,\n\n`;
          emailBody += `You have been unassigned from this feature.\n\n`;
          emailBody += `Feature: ${previousData?.title || 'Untitled Feature'}\n`;
          emailBody += `Description: ${previousData?.description || 'No description'}\n\n`;
          emailBody += `Status: ${statusLabels[previousData?.status || 'idea']}\n`;
          emailBody += `Priority: ${priorityLabels[previousData?.priority || 'medium']}\n`;
          emailBody += `\n---\n`;
          emailBody += `You are no longer responsible for this feature.\n`;
          
          const subject = `Unassigned from: ${previousData?.title || 'Feature'}`;
          
          await sendFeatureUpdateEmail(projectId, featureId, subject, emailBody, normalizedOldAssignedTo, token);
          console.log(`[Feature Email] Unassignment email sent successfully to ${normalizedOldAssignedTo}`);
        } catch (error) {
          console.error('[Feature Email] Failed to send unassignment email:', error);
          if (process.env.NODE_ENV === 'development') {
            throw error;
          }
        }
      }
      
      // Scenario 2: Status changed to released - send to creator
      if (changes.includes('status') && data.status === 'released') {
        try {
          const creatorEmail = getCreatorEmail();
          
          if (creatorEmail && creatorEmail.includes('@')) {
            console.log(`[Feature Email] Sending release email for feature ${featureId}:`, {
              status: data.status,
              creatorEmail,
            });
            
            let emailBody = `Hello,\n\n`;
            emailBody += `Great news! The feature you created has been released.\n\n`;
            emailBody += `Feature: ${previousData?.title || 'Untitled Feature'}\n`;
            emailBody += `Description: ${previousData?.description || 'No description'}\n\n`;
            emailBody += `Status: ${statusLabels[data.status as string]}\n`;
            emailBody += `Priority: ${priorityLabels[previousData?.priority || 'medium']}\n`;
            
            // Use updated completion date if provided, otherwise use previous
            const completionDate = data.completionDate || previousData?.completionDate;
            if (completionDate) {
              emailBody += `Completed: ${format(new Date(completionDate), 'MMM d, yyyy')}\n`;
            }
            
            emailBody += `\n---\n`;
            emailBody += `Thank you for creating this feature. If you have any questions or concerns, please reply to this email.\n`;
            
            const subject = `Feature Released: ${previousData?.title || 'Feature'}`;
            
            await sendFeatureUpdateEmail(projectId, featureId, subject, emailBody, creatorEmail, token);
            console.log(`[Feature Email] Release email sent successfully to ${creatorEmail}`);
          } else {
            console.log('[Feature Email] Status changed to released but no creator email found:', {
              featureId,
              creatorEmail,
            });
          }
        } catch (error) {
          console.error('[Feature Email] Failed to send release email:', error);
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
          console.log(`[Feature Email] Sending email for feature ${featureId}:`, {
            changes,
            emailRecipient,
            normalizedNewAssignedTo,
            normalizedOldAssignedTo,
          });
          try {
            // Build email body
            let emailBody = `Hello,\n\n`;
            
            if (changes.includes('assignment')) {
              if (normalizedOldAssignedTo) {
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
            
            const subject = changes.includes('assignment') && !normalizedOldAssignedTo
              ? `You've been assigned to: ${previousData?.title || 'Feature'}`
              : `Update: ${previousData?.title || 'Feature'}`;
            
            await sendFeatureUpdateEmail(projectId, featureId, subject, emailBody, emailRecipient, token);
            console.log(`[Feature Email] Email sent successfully to ${emailRecipient}`);
          } catch (error) {
            // Log error but don't fail the update
            console.error('[Feature Email] Failed to send feature update email:', error);
            console.error('[Feature Email] Error details:', {
              featureId,
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
          console.warn('[Feature Email] Assignment change detected but no assignee email found:', {
            featureId,
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
  
  return updateDocument<Feature>(projectId, 'features', featureId, data);
}

export async function deleteFeature(projectId: ProjectId, featureId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter-uae
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae';
  
  // Get feature data before deleting (for email notification)
  let featureData: Feature | null = null;
  if (shouldSendEmails) {
    featureData = await getDocumentData<Feature>(projectId, 'features', featureId);
  }
  
  // Delete the feature
  await deleteDocument(projectId, 'features', featureId);
  
  // Send email notification if feature had an assignee
  if (shouldSendEmails && featureData && featureData.assignedTo && featureData.assignedTo.trim() && featureData.assignedTo.includes('@')) {
    try {
      console.log(`[Feature Email] Sending deletion email for feature ${featureId}:`, {
        assignedTo: featureData.assignedTo,
        title: featureData.title,
      });
      
      const emailBody = `Hello,\n\n` +
        `The feature you were assigned to has been deleted.\n\n` +
        `Feature: ${featureData.title || 'Untitled Feature'}\n` +
        `Description: ${featureData.description || 'No description'}\n\n` +
        `---\n` +
        `This feature has been removed from the system. If you have any questions, please contact the team.\n`;
      
      const subject = `Feature Deleted: ${featureData.title || 'Feature'}`;
      
      await sendFeatureUpdateEmail(projectId, featureId, subject, emailBody, featureData.assignedTo, token);
      console.log(`[Feature Email] Deletion email sent successfully to ${featureData.assignedTo}`);
    } catch (error) {
      // Log error but don't fail the deletion
      console.error('[Feature Email] Failed to send deletion email:', error);
      console.error('[Feature Email] Error details:', {
        featureId,
        assignedTo: featureData.assignedTo,
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
