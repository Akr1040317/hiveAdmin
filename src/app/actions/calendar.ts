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
import { generateCalendarItemICS } from '@/lib/calendar-invite';
import { format } from 'date-fns';

export interface CalendarItem {
  id: string;
  title: string;
  type: 'deadline' | 'milestone' | 'event' | 'reminder';
  date: Date;
  time?: string; // Optional time for calendar items (HH:mm format)
  notes?: string;
  status: 'planned' | 'scheduled' | 'completed';
  attendees?: string[]; // Array of email addresses
  reminderDays?: number[]; // Days before event to send reminders
  reminderSent?: Date; // Timestamp when reminder was last sent
  createdAt: Date;
  updatedAt: Date;
}

export async function getCalendarItems(projectId: ProjectId, token?: string | null): Promise<CalendarItem[]> {
  await requireAuth(token);
  return getCollectionData<CalendarItem>(projectId, 'calendar');
}

export async function getCalendarItem(projectId: ProjectId, itemId: string, token?: string | null): Promise<CalendarItem | null> {
  await requireAuth(token);
  return getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
}

export async function createCalendarItem(
  projectId: ProjectId,
  data: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  return createDocument<CalendarItem>(projectId, 'calendar', data);
}

export async function updateCalendarItem(
  projectId: ProjectId,
  itemId: string,
  data: Partial<Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<CalendarItem>(projectId, 'calendar', itemId, data);
}

export async function deleteCalendarItem(projectId: ProjectId, itemId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'calendar', itemId);
}

export async function getCalendarItemsByDateRange(
  projectId: ProjectId,
  startDate: Date,
  endDate: Date,
  token?: string | null
): Promise<CalendarItem[]> {
  await requireAuth(token);
  return queryCollection<CalendarItem>(projectId, 'calendar', (query) =>
    query
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
  );
}

export async function getCalendarItemsByType(
  projectId: ProjectId,
  type: CalendarItem['type'],
  token?: string | null
): Promise<CalendarItem[]> {
  await requireAuth(token);
  return queryCollection<CalendarItem>(projectId, 'calendar', (query) =>
    query.where('type', '==', type)
  );
}

export async function getCalendarItemsByStatus(
  projectId: ProjectId,
  status: CalendarItem['status'],
  token?: string | null
): Promise<CalendarItem[]> {
  await requireAuth(token);
  return queryCollection<CalendarItem>(projectId, 'calendar', (query) =>
    query.where('status', '==', status)
  );
}

/**
 * Send calendar item notification email
 * Only works for prepcenter-uae project
 */
export async function sendCalendarItemNotification(
  projectId: ProjectId,
  itemId: string,
  attendees: string[],
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter-uae
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae';
  
  if (!shouldSendEmails) {
    console.log('[Calendar Email] Skipping notification - not prepcenter-uae project');
    return;
  }
  
  // Get calendar item data
  const item = await getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
  if (!item) {
    throw new Error(`Calendar item ${itemId} not found`);
  }
  
  if (!attendees || attendees.length === 0) {
    throw new Error('No attendees specified for calendar item notification');
  }
  
  // Filter valid email addresses
  const validAttendees = attendees.filter(email => email && email.trim() && email.includes('@'));
  if (validAttendees.length === 0) {
    throw new Error('No valid email addresses found in attendees list');
  }
  
  try {
    console.log(`[Calendar Email] Sending notification for calendar item ${itemId}:`, {
      title: item.title,
      type: item.type,
      attendees: validAttendees,
    });
    
    // Format date/time
    const itemDate = new Date(item.date);
    let dateTimeStr = format(itemDate, 'MMM d, yyyy');
    if (item.time) {
      dateTimeStr += ` at ${item.time}`;
    }
    
    const typeLabels: Record<string, string> = {
      deadline: 'Deadline',
      milestone: 'Milestone',
      event: 'Event',
      reminder: 'Reminder',
    };
    
    // Build email body
    let emailBody = `Hello,\n\n`;
    emailBody += `You have been notified about a ${typeLabels[item.type] || item.type.toLowerCase()}.\n\n`;
    emailBody += `${typeLabels[item.type] || item.type}: ${item.title}\n`;
    emailBody += `Date: ${dateTimeStr}\n`;
    emailBody += `Status: ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}\n`;
    
    if (item.notes) {
      emailBody += `\nNotes:\n${item.notes}\n`;
    }
    
    emailBody += `\n---\n`;
    emailBody += `View this item in the admin panel for more details.\n`;
    
    const subject = `${typeLabels[item.type] || item.type} Notification: ${item.title}`;
    
    // Call Firebase Cloud Function to send email
    const functionUrl = `https://us-central1-prepcenter-750c1.cloudfunctions.net/sendIssueUpdateEmail`;
    
    // Send to each attendee individually
    const emailPromises = validAttendees.map(async (attendeeEmail) => {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: attendeeEmail,
          subject: subject,
          body: emailBody,
          issueId: itemId,
          issueSubject: item.title,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `Failed to send notification to ${attendeeEmail}`);
      }
      
      return result;
    });
    
    await Promise.all(emailPromises);
    
    console.log(`[Calendar Email] Notification sent successfully to ${validAttendees.length} attendee(s)`);
  } catch (error) {
    console.error('[Calendar Email] Failed to send calendar item notification:', error);
    console.error('[Calendar Email] Error details:', {
      itemId,
      attendees: validAttendees,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Send calendar item reminder email
 * Only works for prepcenter-uae project
 */
export async function sendCalendarItemReminder(
  projectId: ProjectId,
  itemId: string,
  daysUntil: number,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter-uae
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae';
  
  if (!shouldSendEmails) {
    console.log('[Calendar Email] Skipping reminder - not prepcenter-uae project');
    return;
  }
  
  // Get calendar item data
  const item = await getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
  if (!item) {
    throw new Error(`Calendar item ${itemId} not found`);
  }
  
  const attendees = item.attendees || [];
  if (attendees.length === 0) {
    throw new Error('No attendees found for calendar item reminder');
  }
  
  // Filter valid email addresses
  const validAttendees = attendees.filter(email => email && email.trim() && email.includes('@'));
  if (validAttendees.length === 0) {
    throw new Error('No valid email addresses found in attendees list');
  }
  
  try {
    console.log(`[Calendar Email] Sending reminder for calendar item ${itemId} (${daysUntil} day(s) before):`, {
      title: item.title,
      type: item.type,
      attendees: validAttendees,
    });
    
    // Format date/time
    const itemDate = new Date(item.date);
    let dateTimeStr = format(itemDate, 'MMM d, yyyy');
    if (item.time) {
      dateTimeStr += ` at ${item.time}`;
    }
    
    const typeLabels: Record<string, string> = {
      deadline: 'Deadline',
      milestone: 'Milestone',
      event: 'Event',
      reminder: 'Reminder',
    };
    
    // Build email body
    let emailBody = `Hello,\n\n`;
    emailBody += `This is a reminder that you have a ${typeLabels[item.type] || item.type.toLowerCase()} ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}.\n\n`;
    emailBody += `${typeLabels[item.type] || item.type}: ${item.title}\n`;
    emailBody += `Date: ${dateTimeStr}\n`;
    emailBody += `Status: ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}\n`;
    
    if (item.notes) {
      emailBody += `\nNotes:\n${item.notes}\n`;
    }
    
    emailBody += `\n---\n`;
    emailBody += `View this item in the admin panel for more details.\n`;
    
    const subject = `Reminder: ${item.title} ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`;
    
    // Call Firebase Cloud Function to send email
    const functionUrl = `https://us-central1-prepcenter-750c1.cloudfunctions.net/sendIssueUpdateEmail`;
    
    // Send to each attendee individually
    const emailPromises = validAttendees.map(async (attendeeEmail) => {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: attendeeEmail,
          subject: subject,
          body: emailBody,
          issueId: itemId,
          issueSubject: item.title,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `Failed to send reminder to ${attendeeEmail}`);
      }
      
      return result;
    });
    
    await Promise.all(emailPromises);
    
    // Update calendar item with reminderSent timestamp
    await updateDocument<CalendarItem>(projectId, 'calendar', itemId, {
      reminderSent: new Date(),
    });
    
    console.log(`[Calendar Email] Reminder sent successfully to ${validAttendees.length} attendee(s)`);
  } catch (error) {
    console.error('[Calendar Email] Failed to send calendar item reminder:', error);
    console.error('[Calendar Email] Error details:', {
      itemId,
      daysUntil,
      attendees: validAttendees,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
