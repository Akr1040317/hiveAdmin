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
  return createDocument<Meeting>(projectId, 'meetings', data);
}

export async function updateMeeting(
  projectId: ProjectId,
  meetingId: string,
  data: Partial<Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  return updateDocument<Meeting>(projectId, 'meetings', meetingId, data);
}

export async function deleteMeeting(projectId: ProjectId, meetingId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'meetings', meetingId);
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
 * Only works for prepcenter projects (prepcenter-uae, prepcenter-oman)
 */
export async function sendMeetingInvite(
  projectId: ProjectId,
  meetingId: string,
  attendees: string[],
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman)
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman';
  
  if (!shouldSendEmails) {
    console.log('[Meeting Email] Skipping email - not prepcenter project');
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
    const functionUrl = `https://us-central1-prepcenter-750c1.cloudfunctions.net/sendMeetingInviteEmail`;
    
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
 * Only works for prepcenter projects (prepcenter-uae, prepcenter-oman)
 */
export async function sendMeetingReminder(
  projectId: ProjectId,
  meetingId: string,
  daysUntil: number,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter projects (prepcenter-uae, prepcenter-oman)
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae' || project?.id === 'prepcenter-oman';
  
  if (!shouldSendEmails) {
    console.log('[Meeting Email] Skipping reminder - not prepcenter project');
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
