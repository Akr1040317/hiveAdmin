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
import { format } from 'date-fns';

export interface Content {
  id: string;
  title: string;
  description: string;
  contentType: 'video' | 'article' | 'tips_tricks' | 'notification' | 'email_campaign' | 'announcement' | 'word_of_the_day';
  channel: 'instagram' | 'whatsapp' | 'email' | 'app' | 'web';
  publishAt?: Date;
  dueAt?: Date;
  requirementPeriod?: string; // e.g., "2024-W01" for weeks, "2024-01-15" for days
  status: 'idea' | 'in_creation' | 'ready' | 'verified' | 'scheduled' | 'sent';
  assignedTo?: string; // Email address of assigned user
  reminderSent?: Date; // Timestamp when 24hr reminder was sent
  verifiedAt?: Date; // Timestamp when content was verified
  verifiedBy?: string; // Email of user who verified
  owner: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getContent(projectId: ProjectId, token?: string | null): Promise<Content[]> {
  await requireAuth(token);
  return getCollectionData<Content>(projectId, 'content');
}

export async function getContentItem(projectId: ProjectId, contentId: string, token?: string | null): Promise<Content | null> {
  await requireAuth(token);
  return getDocumentData<Content>(projectId, 'content', contentId);
}

export async function createContent(
  projectId: ProjectId,
  data: Omit<Content, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  const user = await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  const contentId = await createDocument<Content>(projectId, 'content', data);
  
  // Send email if content is created with an assignee
  if (shouldSendEmails && data.assignedTo && data.assignedTo.trim() && data.assignedTo.includes('@')) {
    try {
      console.log(`[Content Email] Sending assignment email for new content ${contentId}:`, {
        assignedTo: data.assignedTo,
        title: data.title,
      });
      
      const projectName = project?.displayName || projectId;
      const contentTypeLabels: Record<Content['contentType'], string> = {
        video: 'Video',
        article: 'Article',
        tips_tricks: 'Tips & Tricks',
        notification: 'Notification',
        email_campaign: 'Email Campaign',
        announcement: 'Announcement',
        word_of_the_day: 'Word of the Day',
      };
      
      const subject = `[${projectName}] New Content Assigned: ${data.title || 'Untitled Content'}`;
      
      let emailBody = `Hello,\n\n`;
      emailBody += `Project: ${projectName}\n\n`;
      emailBody += `You have been assigned to new content.\n\n`;
      emailBody += `Content: ${data.title || 'Untitled Content'}\n`;
      emailBody += `Type: ${contentTypeLabels[data.contentType] || data.contentType}\n`;
      emailBody += `Channel: ${data.channel}\n`;
      if (data.description) {
        emailBody += `Description: ${data.description}\n`;
      }
      if (data.publishAt) {
        emailBody += `Publish Date: ${format(new Date(data.publishAt), 'MMM d, yyyy h:mm a')}\n`;
      }
      emailBody += `\n---\n`;
      emailBody += `This is an automated notification from the Content Pipeline system.`;
      
      await sendContentUpdateEmail(projectId, contentId, subject, emailBody, token, data.assignedTo);
      console.log(`[Content Email] Email sent successfully to ${data.assignedTo}`);
    } catch (error) {
      // Log error but don't fail the creation
      console.error('[Content Email] Failed to send assignment email for new content:', error);
    }
  }
  
  // Auto-check compliance after creating content (non-blocking)
  if (data.publishAt && token) {
    // Run compliance check asynchronously without blocking
    import('./content-requirements').then(({ checkRequirementCompliance }) => {
      checkRequirementCompliance(projectId, undefined, token).catch((error) => {
        // Silently fail - compliance check is not critical for creation
        console.error('Failed to check compliance:', error);
      });
    });
  }
  
  return contentId;
}

export async function updateContent(
  projectId: ProjectId,
  contentId: string,
  data: Partial<Omit<Content, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  const user = await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  // Get previous data to detect changes
  const previousData = await getDocumentData<Content>(projectId, 'content', contentId);
  
  // Validation: Cannot set status to 'scheduled' or 'sent' unless status is 'verified'
  if (data.status === 'scheduled' || data.status === 'sent') {
    const currentStatus = data.status !== undefined ? data.status : (previousData?.status || 'idea');
    const previousStatus = previousData?.status || 'idea';
    const effectiveStatus = data.status !== undefined ? data.status : previousStatus;
    
    // Check if we're trying to move to scheduled/sent
    if (effectiveStatus === 'scheduled' || effectiveStatus === 'sent') {
      // Check if previous status was verified
      if (previousStatus !== 'verified' && effectiveStatus !== previousStatus) {
        throw new Error('Content must be verified before it can be scheduled or sent');
      }
    }
  }
  
  // Set verifiedAt and verifiedBy when status changes to 'verified'
  if (data.status === 'verified' && previousData?.status !== 'verified') {
    data.verifiedAt = new Date();
    data.verifiedBy = user.email || undefined;
  }
  
  await updateDocument<Content>(projectId, 'content', contentId, data);
  
  // Send emails if enabled
  if (shouldSendEmails) {
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
    if (data.publishAt !== undefined) {
      const newPublishAt = data.publishAt ? new Date(data.publishAt).toISOString().split('T')[0] : null;
      const oldPublishAt = previousData?.publishAt ? new Date(previousData.publishAt).toISOString().split('T')[0] : null;
      if (newPublishAt !== oldPublishAt) {
        changes.push('publishAt');
      }
    }
    
    // Send email if there are changes
    if (changes.length > 0) {
      const projectName = project?.displayName || projectId;
      const contentTypeLabels: Record<Content['contentType'], string> = {
        video: 'Video',
        article: 'Article',
        tips_tricks: 'Tips & Tricks',
        notification: 'Notification',
        email_campaign: 'Email Campaign',
        announcement: 'Announcement',
        word_of_the_day: 'Word of the Day',
      };
      
      const statusLabels: Record<Content['status'], string> = {
        idea: 'Idea',
        in_creation: 'In Creation',
        ready: 'Ready',
        verified: 'Verified',
        scheduled: 'Scheduled',
        sent: 'Sent',
      };
      
      const currentContent = { ...previousData, ...data } as Content;
      
      // Scenario 1: Unassignment - send to old assignee
      if (changes.includes('assignment') && normalizedOldAssignedTo && !normalizedNewAssignedTo) {
        try {
          console.log(`[Content Email] Sending unassignment email for content ${contentId}:`, {
            oldAssignee: normalizedOldAssignedTo,
          });
          
          let emailBody = `Hello,\n\n`;
          emailBody += `Project: ${projectName}\n\n`;
          emailBody += `You have been unassigned from this content.\n\n`;
          emailBody += `Content: ${currentContent.title || 'Untitled Content'}\n`;
          emailBody += `Type: ${contentTypeLabels[currentContent.contentType] || currentContent.contentType}\n`;
          emailBody += `Status: ${statusLabels[currentContent.status] || currentContent.status}\n`;
          emailBody += `\n---\n`;
          emailBody += `You are no longer responsible for this content.\n`;
          
          const subject = `[${projectName}] Unassigned from: ${currentContent.title || 'Content'}`;
          
          await sendContentUpdateEmail(projectId, contentId, subject, emailBody, token, normalizedOldAssignedTo);
          console.log(`[Content Email] Unassignment email sent successfully to ${normalizedOldAssignedTo}`);
        } catch (error) {
          console.error('[Content Email] Failed to send unassignment email:', error);
        }
      }
      
      // Scenario 2: Status changed to 'verified' - send to creator
      if (changes.includes('status') && data.status === 'verified') {
        try {
          const creatorEmail = previousData?.owner;
          
          if (creatorEmail && creatorEmail.includes('@')) {
            console.log(`[Content Email] Sending verification email for content ${contentId}:`, {
              status: data.status,
              creatorEmail,
            });
            
            let emailBody = `Hello,\n\n`;
            emailBody += `Project: ${projectName}\n\n`;
            emailBody += `Your content has been verified and is ready to publish.\n\n`;
            emailBody += `Content: ${currentContent.title || 'Untitled Content'}\n`;
            emailBody += `Type: ${contentTypeLabels[currentContent.contentType] || currentContent.contentType}\n`;
            emailBody += `Status: ${statusLabels[currentContent.status]}\n`;
            if (currentContent.publishAt) {
              emailBody += `Publish Date: ${format(new Date(currentContent.publishAt), 'MMM d, yyyy h:mm a')}\n`;
            }
            emailBody += `Verified by: ${user.email || 'System'}\n`;
            emailBody += `\n---\n`;
            emailBody += `This content is now verified and can be scheduled or sent.\n`;
            
            const subject = `[${projectName}] Content Verified: ${currentContent.title || 'Content'}`;
            
            await sendContentUpdateEmail(projectId, contentId, subject, emailBody, token, creatorEmail);
            console.log(`[Content Email] Verification email sent successfully to ${creatorEmail}`);
          }
        } catch (error) {
          console.error('[Content Email] Failed to send verification email:', error);
        }
      }
      
      // Scenario 3: Status changed to 'sent' - send to creator and assignee
      if (changes.includes('status') && data.status === 'sent') {
        try {
          const recipients: string[] = [];
          if (previousData?.owner && previousData.owner.includes('@')) {
            recipients.push(previousData.owner);
          }
          if (normalizedNewAssignedTo && normalizedNewAssignedTo !== previousData?.owner) {
            recipients.push(normalizedNewAssignedTo);
          }
          
          for (const recipient of recipients) {
            console.log(`[Content Email] Sending sent status email for content ${contentId}:`, {
              status: data.status,
              recipient,
            });
            
            let emailBody = `Hello,\n\n`;
            emailBody += `Project: ${projectName}\n\n`;
            emailBody += `This content has been published/sent.\n\n`;
            emailBody += `Content: ${currentContent.title || 'Untitled Content'}\n`;
            emailBody += `Type: ${contentTypeLabels[currentContent.contentType] || currentContent.contentType}\n`;
            emailBody += `Status: ${statusLabels[currentContent.status]}\n`;
            if (currentContent.publishAt) {
              emailBody += `Publish Date: ${format(new Date(currentContent.publishAt), 'MMM d, yyyy h:mm a')}\n`;
            }
            emailBody += `\n---\n`;
            emailBody += `This content has been successfully published.\n`;
            
            const subject = `[${projectName}] Content Published: ${currentContent.title || 'Content'}`;
            
            await sendContentUpdateEmail(projectId, contentId, subject, emailBody, token, recipient);
            console.log(`[Content Email] Sent status email sent successfully to ${recipient}`);
          }
        } catch (error) {
          console.error('[Content Email] Failed to send sent status email:', error);
        }
      }
      
      // Scenario 4: Assignment/reassignment or other changes - send to assignee
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
          try {
            console.log(`[Content Email] Sending update email for content ${contentId}:`, {
              changes,
              emailRecipient,
            });
            
            let emailBody = `Hello,\n\n`;
            emailBody += `Project: ${projectName}\n\n`;
            emailBody += `This content has been updated.\n\n`;
            emailBody += `Content: ${currentContent.title || 'Untitled Content'}\n`;
            emailBody += `Type: ${contentTypeLabels[currentContent.contentType] || currentContent.contentType}\n`;
            emailBody += `Status: ${statusLabels[currentContent.status] || currentContent.status}\n`;
            if (currentContent.publishAt) {
              emailBody += `Publish Date: ${format(new Date(currentContent.publishAt), 'MMM d, yyyy h:mm a')}\n`;
            }
            
            if (changes.includes('assignment')) {
              emailBody += `\nYou have been assigned to this content.\n`;
            }
            
            emailBody += `\nChanges:\n`;
            if (changes.includes('status')) {
              emailBody += `- Status changed to: ${statusLabels[data.status as Content['status']] || data.status}\n`;
            }
            if (changes.includes('publishAt')) {
              emailBody += `- Publish date updated\n`;
            }
            
            emailBody += `\n---\n`;
            emailBody += `This is an automated notification from the Content Pipeline system.`;
            
            const subject = `[${projectName}] Content Updated: ${currentContent.title || 'Content'}`;
            
            await sendContentUpdateEmail(projectId, contentId, subject, emailBody, token, emailRecipient);
            console.log(`[Content Email] Update email sent successfully to ${emailRecipient}`);
          } catch (error) {
            console.error('[Content Email] Failed to send update email:', error);
          }
        }
      }
    }
  }
  
  // Auto-check compliance after updating content (non-blocking)
  if ((data.publishAt !== undefined || data.contentType !== undefined) && token) {
    // Run compliance check asynchronously without blocking
    import('./content-requirements').then(({ checkRequirementCompliance }) => {
      checkRequirementCompliance(projectId, undefined, token).catch((error) => {
        // Silently fail - compliance check is not critical for update
        console.error('Failed to check compliance:', error);
      });
    });
  }
}

export async function deleteContent(projectId: ProjectId, contentId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'content', contentId);
}

export async function getContentByStatus(
  projectId: ProjectId,
  status: Content['status'],
  token?: string | null
): Promise<Content[]> {
  await requireAuth(token);
  return queryCollection<Content>(projectId, 'content', (query) =>
    query.where('status', '==', status)
  );
}

export async function getContentByChannel(
  projectId: ProjectId,
  channel: Content['channel'],
  token?: string | null
): Promise<Content[]> {
  await requireAuth(token);
  return queryCollection<Content>(projectId, 'content', (query) =>
    query.where('channel', '==', channel)
  );
}

/**
 * Send content update email via Firebase Cloud Function
 * Only works for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
 */
export async function sendContentUpdateEmail(
  projectId: ProjectId,
  contentId: string,
  subject: string,
  body: string,
  token?: string | null,
  recipientEmail?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  if (!shouldSendEmails) {
    console.log('[Content Email] Skipping email - not prepcenter-uae project');
    return;
  }
  
  // Get the content
  const content = await getDocumentData<Content>(projectId, 'content', contentId);
  if (!content) {
    throw new Error(`Content ${contentId} not found`);
  }
  
  // Determine recipient email
  let recipient: string | null = null;
  
  // If recipientEmail is provided, use that
  if (recipientEmail) {
    recipient = recipientEmail;
  } else if (content.assignedTo && content.assignedTo.includes('@')) {
    recipient = content.assignedTo;
  } else if (content.owner && content.owner.includes('@')) {
    recipient = content.owner;
  }
  
  if (!recipient) {
    throw new Error('No recipient email found for this content');
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
      to: recipient,
      subject: subject,
      body: body,
      issueId: contentId,
      issueSubject: content.title || 'Content',
    }),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Failed to send email');
  }
  
  console.log(`[Content Email] Email sent successfully to ${recipient}`);
}

/**
 * Send 24-hour reminder email for content that needs verification
 */
export async function sendContentReminderEmail(
  projectId: ProjectId,
  contentId: string,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  const content = await getDocumentData<Content>(projectId, 'content', contentId);
  if (!content) {
    throw new Error(`Content ${contentId} not found`);
  }
  
  if (!content.publishAt) {
    throw new Error('Content has no publish date');
  }
  
  const project = getProject(projectId);
  const projectName = project?.displayName || projectId;
  const publishDate = new Date(content.publishAt);
  
  const contentTypeLabels: Record<Content['contentType'], string> = {
    video: 'Video',
    article: 'Article',
    tips_tricks: 'Tips & Tricks',
    notification: 'Notification',
    email_campaign: 'Email Campaign',
    announcement: 'Announcement',
    word_of_the_day: 'Word of the Day',
  };
  
  const statusLabels: Record<Content['status'], string> = {
    idea: 'Idea',
    in_creation: 'In Creation',
    ready: 'Ready',
    verified: 'Verified',
    scheduled: 'Scheduled',
    sent: 'Sent',
  };
  
  // Get recipients (owner and assignee if different)
  const recipients: string[] = [];
  if (content.owner && content.owner.includes('@')) {
    recipients.push(content.owner);
  }
  if (content.assignedTo && content.assignedTo.includes('@') && content.assignedTo !== content.owner) {
    recipients.push(content.assignedTo);
  }
  
  if (recipients.length === 0) {
    throw new Error('No valid recipient emails found');
  }
  
  const subject = `[${projectName}] URGENT: Content Publishing in 24 Hours - ${content.title}`;
  
  let emailBody = `Hello,\n\n`;
  emailBody += `Project: ${projectName}\n\n`;
  emailBody += `URGENT: This content is scheduled to publish in 24 hours but has not been verified yet.\n\n`;
  emailBody += `Content Details:\n`;
  emailBody += `Title: ${content.title}\n`;
  emailBody += `Type: ${contentTypeLabels[content.contentType] || content.contentType}\n`;
  emailBody += `Channel: ${content.channel}\n`;
  emailBody += `Status: ${statusLabels[content.status] || content.status}\n`;
  emailBody += `Publish Date: ${format(publishDate, 'MMM d, yyyy h:mm a')}\n\n`;
  if (content.description) {
    emailBody += `Description: ${content.description}\n\n`;
  }
  emailBody += `ACTION REQUIRED:\n`;
  emailBody += `Please verify this content before it publishes. Content must be in "Verified" status before it can be published.\n\n`;
  emailBody += `---\n`;
  emailBody += `This is an automated reminder from the Content Pipeline system.`;
  
  // Send to all recipients
  for (const recipient of recipients) {
    try {
      await sendContentUpdateEmail(projectId, contentId, subject, emailBody, token, recipient);
    } catch (error) {
      console.error(`[Content Email] Failed to send reminder to ${recipient}:`, error);
      // Continue with other recipients even if one fails
    }
  }
  
  // Update reminderSent timestamp
  await updateDocument<Content>(projectId, 'content', contentId, {
    reminderSent: new Date(),
  });
}

/**
 * Check all content due in 24 hours and send reminders if not verified
 * This function should be called periodically (e.g., via cron job or scheduled task)
 */
export async function checkContentReminders(
  projectId: ProjectId,
  token?: string | null
): Promise<{ checked: number; remindersSent: number; errors: number }> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  if (!shouldSendEmails) {
    console.log('[Content Reminder] Skipping reminder check - not prepcenter project');
    return { checked: 0, remindersSent: 0, errors: 0 };
  }
  
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  
  // Query content due in 24-25 hours
  // Note: Firestore doesn't support range queries on multiple fields easily,
  // so we'll query by publishAt range and filter in memory
  const allContent = await queryCollection<Content>(
    projectId,
    'content',
    (query) => query.where('publishAt', '>=', twentyFourHoursFromNow).where('publishAt', '<=', twentyFiveHoursFromNow)
  );
  
  // Filter for unverified content that hasn't had a reminder sent recently
  const contentNeedingReminders = allContent.filter((content) => {
    // Skip if already verified or sent
    if (content.status === 'verified' || content.status === 'sent') {
      return false;
    }
    
    // Skip if reminder was sent in the last 23 hours (prevent duplicates)
    if (content.reminderSent) {
      const reminderSentTime = new Date(content.reminderSent);
      const hoursSinceReminder = (now.getTime() - reminderSentTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceReminder < 23) {
        return false;
      }
    }
    
    return true;
  });
  
  let remindersSent = 0;
  let errors = 0;
  
  // Send reminders for each content item
  for (const content of contentNeedingReminders) {
    try {
      await sendContentReminderEmail(projectId, content.id, token);
      remindersSent++;
      console.log(`[Content Reminder] Reminder sent for content ${content.id}: ${content.title}`);
    } catch (error) {
      errors++;
      console.error(`[Content Reminder] Failed to send reminder for content ${content.id}:`, error);
    }
  }
  
  console.log(`[Content Reminder] Check complete: ${contentNeedingReminders.length} items checked, ${remindersSent} reminders sent, ${errors} errors`);
  
  return {
    checked: contentNeedingReminders.length,
    remindersSent,
    errors,
  };
}
