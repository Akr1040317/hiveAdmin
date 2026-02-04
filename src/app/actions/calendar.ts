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
import { generateCalendarItemICS } from '@/lib/calendar-invite';
import { format } from 'date-fns';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  generateMeetLinkForEvent,
  listGoogleCalendarEvents,
} from '@/lib/google/calendar';

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
  googleCalendarEventId?: string | null; // Google Calendar event ID (null when unsynced)
  googleMeetLink?: string | null; // Google Meet link (null when unsynced)
  googleCalendarSynced?: boolean; // Whether synced to Google Calendar
  googleCalendarHtmlLink?: string | null; // Link to open event in Google Calendar (null when unsynced)
  createdAt: Date;
  updatedAt: Date;
}

export async function getCalendarItems(projectId: ProjectId, token?: string | null): Promise<CalendarItem[]> {
  await requireAuth(token);
  const data = await getCollectionData<CalendarItem>(projectId, 'calendar');
  return serializeForClient(data) as CalendarItem[];
}

export async function getCalendarItem(projectId: ProjectId, itemId: string, token?: string | null): Promise<CalendarItem | null> {
  await requireAuth(token);
  const data = await getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
  return data ? (serializeForClient(data) as CalendarItem) : null;
}

export async function createCalendarItem(
  projectId: ProjectId,
  data: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  
  // Create in Firestore first
  const itemId = await createDocument<CalendarItem>(projectId, 'calendar', data);
  
  // Auto-sync to Google Calendar (non-blocking, graceful failure)
  try {
    await syncCalendarItemToGoogleCalendar(projectId, itemId, false, token);
  } catch (error) {
    // Log error but don't fail the creation
    console.error('[Google Calendar] Failed to auto-sync calendar item:', error);
    // Item is still created in Firestore, user can manually sync later
  }
  
  return itemId;
}

export async function updateCalendarItem(
  projectId: ProjectId,
  itemId: string,
  data: Partial<Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Update in Firestore first
  await updateDocument<CalendarItem>(projectId, 'calendar', itemId, data);
  
  // Get updated item to check sync status
  const updatedItem = await getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
  
  // Auto-sync update to Google Calendar if already synced
  if (updatedItem?.googleCalendarSynced && updatedItem?.googleCalendarEventId) {
    try {
      await syncCalendarItemToGoogleCalendar(projectId, itemId, false, token);
    } catch (error) {
      console.error('[Google Calendar] Failed to auto-sync calendar item update:', error);
      // Update still saved in Firestore
    }
  }
}

export async function deleteCalendarItem(projectId: ProjectId, itemId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  
  // Get item to check sync status before deleting
  const item = await getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
  
  // Delete from Google Calendar if synced
  if (item?.googleCalendarSynced && item?.googleCalendarEventId) {
    try {
      await unsyncCalendarItemFromGoogleCalendar(projectId, itemId, token);
    } catch (error) {
      console.error('[Google Calendar] Failed to delete calendar item from Google Calendar:', error);
      // Continue with Firestore deletion even if Google Calendar deletion fails
    }
  }
  
  // Delete from Firestore
  await deleteDocument(projectId, 'calendar', itemId);
}

export async function getCalendarItemsByDateRange(
  projectId: ProjectId,
  startDate: Date,
  endDate: Date,
  token?: string | null
): Promise<CalendarItem[]> {
  await requireAuth(token);
  const data = await queryCollection<CalendarItem>(projectId, 'calendar', (query) =>
    query
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
  );
  return serializeForClient(data) as CalendarItem[];
}

export async function getCalendarItemsByType(
  projectId: ProjectId,
  type: CalendarItem['type'],
  token?: string | null
): Promise<CalendarItem[]> {
  await requireAuth(token);
  const data = await queryCollection<CalendarItem>(projectId, 'calendar', (query) =>
    query.where('type', '==', type)
  );
  return serializeForClient(data) as CalendarItem[];
}

export async function getCalendarItemsByStatus(
  projectId: ProjectId,
  status: CalendarItem['status'],
  token?: string | null
): Promise<CalendarItem[]> {
  await requireAuth(token);
  const data = await queryCollection<CalendarItem>(projectId, 'calendar', (query) =>
    query.where('status', '==', status)
  );
  return serializeForClient(data) as CalendarItem[];
}

/**
 * Send calendar item notification email
 * Only works for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
 */
export async function sendCalendarItemNotification(
  projectId: ProjectId,
  itemId: string,
  attendees: string[],
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  if (!shouldSendEmails) {
    console.log('[Calendar Email] Skipping notification - not supported project');
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
    const projectName = project?.displayName || projectId;
    let emailBody = `Hello,\n\n`;
    emailBody += `Project: ${projectName}\n\n`;
    emailBody += `You have been notified about a ${typeLabels[item.type] || item.type.toLowerCase()}.\n\n`;
    emailBody += `${typeLabels[item.type] || item.type}: ${item.title}\n`;
    emailBody += `Date: ${dateTimeStr}\n`;
    emailBody += `Status: ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}\n`;
    
    if (item.notes) {
      emailBody += `\nNotes:\n${item.notes}\n`;
    }
    
    emailBody += `\n---\n`;
    emailBody += `View this item in the admin panel for more details.\n`;
    
    const subject = `[${projectName}] ${typeLabels[item.type] || item.type} Notification: ${item.title}`;
    
    // Call Firebase Cloud Function to send email
    const { getFirebaseFunctionUrl } = await import('@/lib/firebase-function-urls');
    const functionUrl = getFirebaseFunctionUrl(projectId, 'sendIssueUpdateEmail');
    
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
 * Only works for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
 */
export async function sendCalendarItemReminder(
  projectId: ProjectId,
  itemId: string,
  daysUntil: number,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  if (!shouldSendEmails) {
    console.log('[Calendar Email] Skipping reminder - not supported project');
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
    const projectName = project?.displayName || projectId;
    let emailBody = `Hello,\n\n`;
    emailBody += `Project: ${projectName}\n\n`;
    emailBody += `This is a reminder that you have a ${typeLabels[item.type] || item.type.toLowerCase()} ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}.\n\n`;
    emailBody += `${typeLabels[item.type] || item.type}: ${item.title}\n`;
    emailBody += `Date: ${dateTimeStr}\n`;
    emailBody += `Status: ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}\n`;
    
    if (item.notes) {
      emailBody += `\nNotes:\n${item.notes}\n`;
    }
    
    emailBody += `\n---\n`;
    emailBody += `View this item in the admin panel for more details.\n`;
    
    const subject = `[${projectName}] Reminder: ${item.title} ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`;
    
    // Call Firebase Cloud Function to send email
    const { getFirebaseFunctionUrl } = await import('@/lib/firebase-function-urls');
    const functionUrl = getFirebaseFunctionUrl(projectId, 'sendIssueUpdateEmail');
    
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

/**
 * Sync calendar item to Google Calendar (create or update)
 * Creates a Google Calendar event and stores the event ID
 */
export async function syncCalendarItemToGoogleCalendar(
  projectId: ProjectId,
  itemId: string,
  generateMeetLink: boolean = false,
  token?: string | null
): Promise<{ eventId: string; meetLink?: string; htmlLink: string }> {
  await requireAuth(token);
  
  // Get calendar item data
  const item = await getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
  if (!item) {
    throw new Error(`Calendar item ${itemId} not found`);
  }

  // Parse date and time
  let startDate = new Date(item.date);
  if (item.time) {
    const [hours, minutes] = item.time.split(':').map(Number);
    startDate.setHours(hours, minutes || 0, 0, 0);
  } else {
    // Default to 9 AM if no time specified
    startDate.setHours(9, 0, 0, 0);
  }

  // Default duration: 1 hour for events, all day for deadlines/milestones
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  try {
    let result: { eventId: string; meetLink?: string; htmlLink: string };

    if (item.googleCalendarEventId) {
      // Update existing event
      const updateResult = await updateCalendarEvent(item.googleCalendarEventId, {
        summary: item.title,
        description: item.notes || undefined,
        startTime: startDate,
        endTime: endDate,
        attendees: item.attendees,
        generateMeetLink: generateMeetLink && !item.googleMeetLink,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      result = {
        eventId: item.googleCalendarEventId,
        meetLink: updateResult.meetLink,
        htmlLink: updateResult.htmlLink,
      };
    } else {
      // Create new event
      result = await createCalendarEvent({
        summary: item.title,
        description: item.notes || undefined,
        startTime: startDate,
        endTime: endDate,
        attendees: item.attendees,
        generateMeetLink,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    // Update calendar item with Google Calendar info
    await updateDocument<CalendarItem>(projectId, 'calendar', itemId, {
      googleCalendarEventId: result.eventId,
      googleMeetLink: result.meetLink || item.googleMeetLink,
      googleCalendarSynced: true,
      googleCalendarHtmlLink: result.htmlLink,
    });

    return result;
  } catch (error) {
    console.error('[Google Calendar] Failed to sync calendar item:', error);
    throw error;
  }
}

/**
 * Generate Google Meet link for an existing calendar item
 */
export async function generateMeetLinkForCalendarItem(
  projectId: ProjectId,
  itemId: string,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  
  // Get calendar item data
  const item = await getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
  if (!item) {
    throw new Error(`Calendar item ${itemId} not found`);
  }

  if (!item.googleCalendarEventId) {
    throw new Error('Calendar item must be synced to Google Calendar first');
  }

  try {
    const meetLink = await generateMeetLinkForEvent(item.googleCalendarEventId);

    // Update calendar item with Meet link
    await updateDocument<CalendarItem>(projectId, 'calendar', itemId, {
      googleMeetLink: meetLink,
    });

    return meetLink;
  } catch (error) {
    console.error('[Google Calendar] Failed to generate Meet link:', error);
    throw error;
  }
}

/**
 * Unsync calendar item from Google Calendar (delete the event)
 */
export async function unsyncCalendarItemFromGoogleCalendar(
  projectId: ProjectId,
  itemId: string,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Get calendar item data
  const item = await getDocumentData<CalendarItem>(projectId, 'calendar', itemId);
  if (!item) {
    throw new Error(`Calendar item ${itemId} not found`);
  }

  if (!item.googleCalendarEventId) {
    // Already unsynced
    return;
  }

  try {
    await deleteCalendarEvent(item.googleCalendarEventId);

    // Clear Google Calendar info from calendar item
    await updateDocument<CalendarItem>(projectId, 'calendar', itemId, {
      googleCalendarEventId: null,
      googleMeetLink: null,
      googleCalendarSynced: false,
      googleCalendarHtmlLink: null,
    });
  } catch (error) {
    console.error('[Google Calendar] Failed to unsync calendar item:', error);
    // Don't throw - allow unsync even if event was already deleted externally
    // Still clear the local fields
    await updateDocument<CalendarItem>(projectId, 'calendar', itemId, {
      googleCalendarEventId: null,
      googleMeetLink: null,
      googleCalendarSynced: false,
      googleCalendarHtmlLink: null,
    });
  }
}

/**
 * Import events from Google Calendar into Firestore
 * Only works for prepcenter projects (prepcenter-uae, prepcenter-oman)
 */
export async function importEventsFromGoogleCalendar(
  projectId: ProjectId,
  token?: string | null
): Promise<{ imported: number; updated: number; skipped: number; logs?: string[] }> {
  await requireAuth(token);
  
  // Only import for prepcenter projects (prepcenter-uae, prepcenter-oman)
  const project = getProject(projectId);
  const shouldImport = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman';
  
  if (!shouldImport) {
    console.log('[Google Calendar] Skipping import - not a prepcenter project');
    return { imported: 0, updated: 0, skipped: 0 };
  }
  
  // Get events from Google Calendar (last 30 days to 1 year ahead)
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 30);
  const timeMax = new Date();
  timeMax.setFullYear(timeMax.getFullYear() + 1);
  
  let googleEvents: any[] = [];
  const logs: string[] = [];
  
  // Intercept console.log calls from calendar module to capture all logs
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Flag to prevent recursion when we call original console methods
  let isIntercepting = false;
  
  // Helper to collect logs for client-side display
  // This uses original console methods to avoid recursion
  const addLog = (message: string) => {
    logs.push(message);
    // Use original console.log to avoid recursion
    if (!isIntercepting) {
      originalConsoleLog(message);
    }
  };
  
  const safeStringify = (arg: unknown): string => {
    if (typeof arg === 'string') return arg;
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  };

  console.log = (...args: unknown[]) => {
    isIntercepting = true;
    try {
      const message = args.map(safeStringify).join(' ');
      if (message.includes('[Google Calendar]')) {
        logs.push(message);
      }
      originalConsoleLog.apply(console, args);
    } finally {
      isIntercepting = false;
    }
  };

  console.error = (...args: unknown[]) => {
    isIntercepting = true;
    try {
      const message = args.map(safeStringify).join(' ');
      if (message.includes('[Google Calendar]')) {
        logs.push(`[Google Calendar] ERROR: ${message}`);
      }
      originalConsoleError.apply(console, args);
    } finally {
      isIntercepting = false;
    }
  };

  console.warn = (...args: unknown[]) => {
    isIntercepting = true;
    try {
      const message = args.map(safeStringify).join(' ');
      if (message.includes('[Google Calendar]')) {
        logs.push(`[Google Calendar] WARNING: ${message}`);
      }
      originalConsoleWarn.apply(console, args);
    } finally {
      isIntercepting = false;
    }
  };
  
  try {
    addLog('[Google Calendar] Starting import process...');
    addLog(`[Google Calendar] Project: ${projectId}`);
    addLog(`[Google Calendar] Time range: ${timeMin.toISOString()} to ${timeMax.toISOString()}`);
    
    // List available calendars for debugging
    const { listCalendars } = await import('@/lib/google/calendar');
    try {
      addLog('[Google Calendar] Listing available calendars...');
      const availableCalendars = await listCalendars();
      addLog(`[Google Calendar] Service account has access to ${availableCalendars.length} calendar(s)`);
      availableCalendars.forEach((cal, idx) => {
        addLog(`[Google Calendar]   ${idx + 1}. ${cal.summary} (${cal.id}) ${cal.primary ? '[PRIMARY]' : ''}`);
      });
    } catch (err: any) {
      addLog(`[Google Calendar] WARNING: Could not list calendars: ${err?.message || String(err)}`);
      addLog('[Google Calendar] Skipping calendar list (service account has no user context for calendarList.list).');
    }
    
    addLog('[Google Calendar] Fetching events from Google Calendar...');
    googleEvents = await listGoogleCalendarEvents(timeMin, timeMax);
    addLog(`[Google Calendar] Successfully fetched ${googleEvents.length} events`);
  } catch (error: any) {
    // Handle Google Calendar API errors gracefully
    const errorMessage = error?.message || String(error);
    addLog(`[Google Calendar] ERROR: Failed to import events: ${errorMessage}`);
    addLog(`[Google Calendar] Error code: ${error?.code || 'unknown'}`);
    addLog(`[Google Calendar] Error status: ${error?.response?.status || 'unknown'}`);
    
    if (error?.response?.data) {
      addLog(`[Google Calendar] Error response: ${JSON.stringify(error.response.data)}`);
    }
    
    // Check for specific error types
    if (errorMessage.includes('service account not configured') || 
        errorMessage.includes('GOOGLE_SERVICE_ACCOUNT')) {
      addLog('[Google Calendar] DIAGNOSIS: Service account not configured');
    } else if (errorMessage.includes('authorize') || errorMessage.includes('authentication')) {
      addLog('[Google Calendar] DIAGNOSIS: Authentication failed');
    } else if (errorMessage.includes('API') || errorMessage.includes('not enabled')) {
      addLog('[Google Calendar] DIAGNOSIS: API may not be enabled');
    } else if (errorMessage.includes('unregistered callers')) {
      addLog('[Google Calendar] DIAGNOSIS: Unregistered callers error - API may not recognize service account');
    } else {
      addLog(`[Google Calendar] DIAGNOSIS: Unknown error type`);
    }
    
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    
    // Return plain serializable object for client (no class instances)
    return {
      imported: 0,
      updated: 0,
      skipped: 0,
      logs: logs.map((s) => (typeof s === 'string' ? s : String(s))),
    };
  } finally {
    // Always restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
  
  // Add success logs
  addLog(`[Google Calendar] Processing ${googleEvents.length} events...`);
  
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  
  for (let i = 0; i < googleEvents.length; i++) {
    const googleEvent = googleEvents[i];
    if (i < 5) { // Log first 5 events for debugging
      addLog(`[Google Calendar] Event ${i + 1}: ${googleEvent.summary} (${googleEvent.id})`);
    }
    // Check if event already exists in Firestore (by googleCalendarEventId)
    const existingItems = await queryCollection<CalendarItem>(
      projectId,
      'calendar',
      (query) => query.where('googleCalendarEventId', '==', googleEvent.id)
    );
    
    const existingItem = existingItems[0];
    
    // Parse date/time from Google Calendar event
    const startDate = new Date(googleEvent.start);
    const endDate = new Date(googleEvent.end);
    const timeStr = startDate.toTimeString().slice(0, 5); // HH:mm format
    
    // Determine if it's an all-day event
    const isAllDay = !googleEvent.start.includes('T');
    
    // Map Google Calendar event to CalendarItem
    const itemData: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'> = {
      title: googleEvent.summary,
      type: 'event', // Default to 'event' type
      date: isAllDay ? startDate : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
      time: isAllDay ? undefined : timeStr,
      notes: googleEvent.description || '',
      status: 'scheduled',
      attendees: googleEvent.attendees || [],
      googleCalendarEventId: googleEvent.id,
      googleMeetLink: googleEvent.hangoutLink,
      googleCalendarSynced: true,
      googleCalendarHtmlLink: googleEvent.htmlLink,
    };
    
    if (existingItem) {
      // Update existing item if it differs
      const needsUpdate = 
        existingItem.title !== itemData.title ||
        existingItem.notes !== itemData.notes ||
        existingItem.date.getTime() !== itemData.date.getTime() ||
        existingItem.time !== itemData.time ||
        JSON.stringify(existingItem.attendees || []) !== JSON.stringify(itemData.attendees || []);
      
      if (needsUpdate) {
        await updateDocument<CalendarItem>(projectId, 'calendar', existingItem.id, {
          title: itemData.title,
          notes: itemData.notes,
          date: itemData.date,
          time: itemData.time,
          attendees: itemData.attendees,
          googleMeetLink: itemData.googleMeetLink,
          googleCalendarHtmlLink: itemData.googleCalendarHtmlLink,
        });
        updated++;
      } else {
        skipped++;
      }
    } else {
      // Create new item
      await createDocument<CalendarItem>(projectId, 'calendar', itemData);
      imported++;
    }
  }
  
  addLog(`[Google Calendar] Import complete: ${imported} imported, ${updated} updated, ${skipped} skipped`);
  
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  
  // Return plain serializable object for client (no class instances)
  return {
    imported: Number(imported),
    updated: Number(updated),
    skipped: Number(skipped),
    logs: logs.map((s) => (typeof s === 'string' ? s : String(s))),
  };
}
