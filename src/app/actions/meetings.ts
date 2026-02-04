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
import { generateICSFile } from '@/lib/calendar-invite';
import { format } from 'date-fns';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  generateMeetLinkForEvent,
  CreateCalendarEventOptions,
} from '@/lib/google/calendar';

export interface Meeting {
  id: string;
  title: string;
  startsAt: Date;
  meetingType: 'internal' | 'partner' | 'ops' | 'review';
  agenda: string;
  notes: string;
  actionItems: string[];
  attendees?: string[]; // Array of email addresses
  duration?: number; // Meeting duration in minutes (default: 60)
  location?: string; // Meeting location/venue
  inviteSent?: Date; // Timestamp when invite was last sent
  reminderSent?: Date; // Timestamp when reminder was last sent
  reminderDays?: number[]; // Days before meeting to send reminders (e.g., [1, 7])
  googleCalendarEventId?: string; // Google Calendar event ID
  googleMeetLink?: string; // Google Meet link
  googleCalendarSynced?: boolean; // Whether synced to Google Calendar
  googleCalendarHtmlLink?: string; // Link to open event in Google Calendar
  createdAt: Date;
  updatedAt: Date;
}

export async function getMeetings(projectId: ProjectId, token?: string | null): Promise<Meeting[]> {
  await requireAuth(token);
  return getCollectionData<Meeting>(projectId, 'meetings');
}

export async function getMeeting(projectId: ProjectId, meetingId: string, token?: string | null): Promise<Meeting | null> {
  await requireAuth(token);
  return getDocumentData<Meeting>(projectId, 'meetings', meetingId);
}

export async function createMeeting(
  projectId: ProjectId,
  data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  
  // Create in Firestore first
  const meetingId = await createDocument<Meeting>(projectId, 'meetings', data);
  
  // Auto-sync to Google Calendar with Meet link (non-blocking, graceful failure)
  try {
    await syncMeetingToGoogleCalendar(projectId, meetingId, true, token);
  } catch (error) {
    // Log error but don't fail the creation
    console.error('[Google Calendar] Failed to auto-sync meeting:', error);
    // Meeting is still created in Firestore, user can manually sync later
  }
  
  return meetingId;
}

export async function updateMeeting(
  projectId: ProjectId,
  meetingId: string,
  data: Partial<Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Update in Firestore first
  await updateDocument<Meeting>(projectId, 'meetings', meetingId, data);
  
  // Get updated meeting to check sync status
  const updatedMeeting = await getDocumentData<Meeting>(projectId, 'meetings', meetingId);
  
  // Auto-sync update to Google Calendar if already synced
  if (updatedMeeting?.googleCalendarSynced && updatedMeeting?.googleCalendarEventId) {
    try {
      await syncMeetingToGoogleCalendar(projectId, meetingId, false, token);
    } catch (error) {
      console.error('[Google Calendar] Failed to auto-sync meeting update:', error);
      // Update still saved in Firestore
    }
  }
}

export async function deleteMeeting(projectId: ProjectId, meetingId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  
  // Get meeting to check sync status before deleting
  const meeting = await getDocumentData<Meeting>(projectId, 'meetings', meetingId);
  
  // Delete from Google Calendar if synced
  if (meeting?.googleCalendarSynced && meeting?.googleCalendarEventId) {
    try {
      await unsyncMeetingFromGoogleCalendar(projectId, meetingId, token);
    } catch (error) {
      console.error('[Google Calendar] Failed to delete meeting from Google Calendar:', error);
      // Continue with Firestore deletion even if Google Calendar deletion fails
    }
  }
  
  // Delete from Firestore
  await deleteDocument(projectId, 'meetings', meetingId);
}

export async function getUpcomingMeetings(projectId: ProjectId, token?: string | null): Promise<Meeting[]> {
  await requireAuth(token);
  const now = new Date();
  return queryCollection<Meeting>(projectId, 'meetings', (query) =>
    query.where('startsAt', '>=', now).orderBy('startsAt', 'asc')
  );
}

export async function getPastMeetings(projectId: ProjectId, token?: string | null): Promise<Meeting[]> {
  await requireAuth(token);
  const now = new Date();
  return queryCollection<Meeting>(projectId, 'meetings', (query) =>
    query.where('startsAt', '<', now).orderBy('startsAt', 'desc')
  );
}

export async function getMeetingsByType(
  projectId: ProjectId,
  meetingType: Meeting['meetingType'],
  token?: string | null
): Promise<Meeting[]> {
  await requireAuth(token);
  return queryCollection<Meeting>(projectId, 'meetings', (query) =>
    query.where('meetingType', '==', meetingType)
  );
}

/**
 * Send meeting invitation email with .ics calendar file attachment
 * Only works for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
 */
export async function sendMeetingInvite(
  projectId: ProjectId,
  meetingId: string,
  attendees: string[],
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  if (!shouldSendEmails) {
    console.log('[Meeting Email] Skipping email - not supported project');
    return;
  }
  
  // Get meeting data
  const meeting = await getDocumentData<Meeting>(projectId, 'meetings', meetingId);
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`);
  }
  
  if (!attendees || attendees.length === 0) {
    throw new Error('No attendees specified for meeting invitation');
  }
  
  // Filter valid email addresses
  const validAttendees = attendees.filter(email => email && email.trim() && email.includes('@'));
  if (validAttendees.length === 0) {
    throw new Error('No valid email addresses found in attendees list');
  }
  
  try {
    console.log(`[Meeting Email] Sending invitation for meeting ${meetingId}:`, {
      title: meeting.title,
      attendees: validAttendees,
    });
    
    // Generate .ics file
    const icsContent = generateICSFile(meeting, validAttendees);
    
    // Format meeting details for email
    const startDate = new Date(meeting.startsAt);
    const durationMinutes = meeting.duration || 60;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    
    const meetingTypeLabels: Record<string, string> = {
      internal: 'Internal',
      partner: 'Partner',
      ops: 'Ops',
      review: 'Review',
    };
    
    // Build email body
    const projectName = project?.displayName || projectId;
    let emailBody = `Hello,\n\n`;
    emailBody += `Project: ${projectName}\n\n`;
    emailBody += `You have been invited to a meeting.\n\n`;
    emailBody += `Meeting: ${meeting.title}\n`;
    emailBody += `Type: ${meetingTypeLabels[meeting.meetingType] || meeting.meetingType}\n`;
    emailBody += `Date & Time: ${format(startDate, 'MMM d, yyyy h:mm a')}\n`;
    emailBody += `Duration: ${durationMinutes} minutes\n`;
    emailBody += `End Time: ${format(endDate, 'h:mm a')}\n`;
    
    if (meeting.location) {
      emailBody += `Location: ${meeting.location}\n`;
    }
    
    if (meeting.agenda) {
      emailBody += `\nAgenda:\n${meeting.agenda}\n`;
    }
    
    if (validAttendees.length > 0) {
      emailBody += `\nAttendees:\n`;
      validAttendees.forEach(attendee => {
        emailBody += `- ${attendee}\n`;
      });
    }
    
    emailBody += `\n---\n`;
    emailBody += `A calendar invitation (.ics file) is attached to this email. You can add it to your calendar.\n`;
    emailBody += `View this meeting in the admin panel for more details.\n`;
    
    const subject = `[${projectName}] Meeting Invitation: ${meeting.title}`;
    
    // Call Firebase Cloud Function to send email with .ics attachment
    const { getFirebaseFunctionUrl } = await import('@/lib/firebase-function-urls');
    const functionUrl = getFirebaseFunctionUrl(projectId, 'sendMeetingInviteEmail');
    
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
          icsContent: icsContent,
          meetingId: meetingId,
          meetingTitle: meeting.title,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `Failed to send email to ${attendeeEmail}`);
      }
      
      return result;
    });
    
    await Promise.all(emailPromises);
    
    // Update meeting with inviteSent timestamp
    await updateDocument<Meeting>(projectId, 'meetings', meetingId, {
      inviteSent: new Date(),
    });
    
    console.log(`[Meeting Email] Invitation sent successfully to ${validAttendees.length} attendee(s)`);
  } catch (error) {
    console.error('[Meeting Email] Failed to send meeting invitation:', error);
    console.error('[Meeting Email] Error details:', {
      meetingId,
      attendees: validAttendees,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Send meeting reminder email
 * Only works for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
 */
export async function sendMeetingReminder(
  projectId: ProjectId,
  meetingId: string,
  daysUntil: number,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman) and hive-learner
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman' || project?.id === 'hive-learner';
  
  if (!shouldSendEmails) {
    console.log('[Meeting Email] Skipping reminder - not supported project');
    return;
  }
  
  // Get meeting data
  const meeting = await getDocumentData<Meeting>(projectId, 'meetings', meetingId);
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`);
  }
  
  const attendees = meeting.attendees || [];
  if (attendees.length === 0) {
    throw new Error('No attendees found for meeting reminder');
  }
  
  // Filter valid email addresses
  const validAttendees = attendees.filter(email => email && email.trim() && email.includes('@'));
  if (validAttendees.length === 0) {
    throw new Error('No valid email addresses found in attendees list');
  }
  
  try {
    console.log(`[Meeting Email] Sending reminder for meeting ${meetingId} (${daysUntil} day(s) before):`, {
      title: meeting.title,
      attendees: validAttendees,
    });
    
    const startDate = new Date(meeting.startsAt);
    const durationMinutes = meeting.duration || 60;
    
    const meetingTypeLabels: Record<string, string> = {
      internal: 'Internal',
      partner: 'Partner',
      ops: 'Ops',
      review: 'Review',
    };
    
    // Build email body
    const projectName = project?.displayName || projectId;
    let emailBody = `Hello,\n\n`;
    emailBody += `Project: ${projectName}\n\n`;
    emailBody += `This is a reminder that you have a meeting ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}.\n\n`;
    emailBody += `Meeting: ${meeting.title}\n`;
    emailBody += `Type: ${meetingTypeLabels[meeting.meetingType] || meeting.meetingType}\n`;
    emailBody += `Date & Time: ${format(startDate, 'MMM d, yyyy h:mm a')}\n`;
    emailBody += `Duration: ${durationMinutes} minutes\n`;
    
    if (meeting.location) {
      emailBody += `Location: ${meeting.location}\n`;
    }
    
    if (meeting.agenda) {
      emailBody += `\nAgenda:\n${meeting.agenda}\n`;
    }
    
    emailBody += `\n---\n`;
    emailBody += `View this meeting in the admin panel for more details.\n`;
    
    const subject = `[${projectName}] Reminder: ${meeting.title} ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`;
    
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
          issueId: meetingId,
          issueSubject: meeting.title,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `Failed to send reminder to ${attendeeEmail}`);
      }
      
      return result;
    });
    
    await Promise.all(emailPromises);
    
    // Update meeting with reminderSent timestamp
    await updateDocument<Meeting>(projectId, 'meetings', meetingId, {
      reminderSent: new Date(),
    });
    
    console.log(`[Meeting Email] Reminder sent successfully to ${validAttendees.length} attendee(s)`);
  } catch (error) {
    console.error('[Meeting Email] Failed to send meeting reminder:', error);
    console.error('[Meeting Email] Error details:', {
      meetingId,
      daysUntil,
      attendees: validAttendees,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * Sync meeting to Google Calendar (create or update)
 * Creates a Google Calendar event and stores the event ID and Meet link
 */
export async function syncMeetingToGoogleCalendar(
  projectId: ProjectId,
  meetingId: string,
  generateMeetLink: boolean = true,
  token?: string | null
): Promise<{ eventId: string; meetLink?: string; htmlLink: string }> {
  await requireAuth(token);
  
  // Get meeting data
  const meeting = await getDocumentData<Meeting>(projectId, 'meetings', meetingId);
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`);
  }

  const startDate = new Date(meeting.startsAt);
  const durationMinutes = meeting.duration || 60;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  // Build description from agenda and notes
  let description = '';
  if (meeting.agenda) {
    description += `Agenda: ${meeting.agenda}`;
  }
  if (meeting.notes) {
    if (description) description += '\n\n';
    description += `Notes: ${meeting.notes}`;
  }
  if (meeting.actionItems && meeting.actionItems.length > 0) {
    if (description) description += '\n\n';
    description += `Action Items:\n${meeting.actionItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}`;
  }

  try {
    let result: { eventId: string; meetLink?: string; htmlLink: string };

    if (meeting.googleCalendarEventId) {
      // Update existing event
      const updateResult = await updateCalendarEvent(meeting.googleCalendarEventId, {
        summary: meeting.title,
        description: description || undefined,
        startTime: startDate,
        endTime: endDate,
        location: meeting.location,
        attendees: meeting.attendees,
        generateMeetLink: generateMeetLink && !meeting.googleMeetLink,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      result = {
        eventId: meeting.googleCalendarEventId,
        meetLink: updateResult.meetLink,
        htmlLink: updateResult.htmlLink,
      };
    } else {
      // Create new event
      result = await createCalendarEvent({
        summary: meeting.title,
        description: description || undefined,
        startTime: startDate,
        endTime: endDate,
        location: meeting.location,
        attendees: meeting.attendees,
        generateMeetLink,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }

    // Update meeting with Google Calendar info
    await updateDocument<Meeting>(projectId, 'meetings', meetingId, {
      googleCalendarEventId: result.eventId,
      googleMeetLink: result.meetLink || meeting.googleMeetLink,
      googleCalendarSynced: true,
      googleCalendarHtmlLink: result.htmlLink,
    });

    return result;
  } catch (error) {
    console.error('[Google Calendar] Failed to sync meeting:', error);
    throw error;
  }
}

/**
 * Generate Google Meet link for an existing meeting
 */
export async function generateMeetLinkForMeeting(
  projectId: ProjectId,
  meetingId: string,
  token?: string | null
): Promise<string> {
  await requireAuth(token);
  
  // Get meeting data
  const meeting = await getDocumentData<Meeting>(projectId, 'meetings', meetingId);
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`);
  }

  if (!meeting.googleCalendarEventId) {
    throw new Error('Meeting must be synced to Google Calendar first');
  }

  try {
    const meetLink = await generateMeetLinkForEvent(meeting.googleCalendarEventId);

    // Update meeting with Meet link
    await updateDocument<Meeting>(projectId, 'meetings', meetingId, {
      googleMeetLink: meetLink,
    });

    return meetLink;
  } catch (error) {
    console.error('[Google Calendar] Failed to generate Meet link:', error);
    throw error;
  }
}

/**
 * Unsync meeting from Google Calendar (delete the event)
 */
export async function unsyncMeetingFromGoogleCalendar(
  projectId: ProjectId,
  meetingId: string,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Get meeting data
  const meeting = await getDocumentData<Meeting>(projectId, 'meetings', meetingId);
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`);
  }

  if (!meeting.googleCalendarEventId) {
    // Already unsynced
    return;
  }

  try {
    await deleteCalendarEvent(meeting.googleCalendarEventId);

    // Clear Google Calendar info from meeting
    await updateDocument<Meeting>(projectId, 'meetings', meetingId, {
      googleCalendarEventId: undefined,
      googleMeetLink: undefined,
      googleCalendarSynced: false,
      googleCalendarHtmlLink: undefined,
    });
  } catch (error) {
    console.error('[Google Calendar] Failed to unsync meeting:', error);
    // Don't throw - allow unsync even if event was already deleted externally
    // Still clear the local fields
    await updateDocument<Meeting>(projectId, 'meetings', meetingId, {
      googleCalendarEventId: undefined,
      googleMeetLink: undefined,
      googleCalendarSynced: false,
      googleCalendarHtmlLink: undefined,
    });
  }
}
