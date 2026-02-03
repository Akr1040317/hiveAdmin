import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

let calendarClient: any = null;

/**
 * Initialize Google Calendar API client using service account
 */
function initializeCalendarClient() {
  if (calendarClient) {
    return calendarClient;
  }

  // Get service account credentials from environment
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountJson && !serviceAccountPath) {
    throw new Error(
      'Google Calendar service account not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PATH'
    );
  }

  let credentials: any;
  
  if (serviceAccountJson) {
    try {
      // Try parsing as JSON string (for Vercel/production)
      credentials = typeof serviceAccountJson === 'string' 
        ? JSON.parse(serviceAccountJson) 
        : serviceAccountJson;
    } catch (error) {
      throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON');
    }
  } else if (serviceAccountPath) {
    // Load from file (for local development)
    const fs = require('fs');
    const path = require('path');
    const resolvedPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }
    
    credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }

  // Create JWT client
  const jwtClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  // Initialize Calendar API
  calendarClient = google.calendar({ version: 'v3', auth: jwtClient as any });

  return calendarClient;
}

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: {
        type: 'hangoutsMeet';
      };
    };
  };
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

export interface CreateCalendarEventOptions {
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  attendees?: string[];
  generateMeetLink?: boolean;
  timeZone?: string;
  reminders?: Array<{ method: 'email' | 'popup'; minutes: number }>;
}

/**
 * Create a Google Calendar event
 */
export async function createCalendarEvent(
  options: CreateCalendarEventOptions
): Promise<{ eventId: string; meetLink?: string; htmlLink: string }> {
  const client = initializeCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const event: GoogleCalendarEvent = {
    summary: options.summary,
    description: options.description,
    start: {
      dateTime: options.startTime.toISOString(),
      timeZone: options.timeZone || 'UTC',
    },
    end: {
      dateTime: options.endTime.toISOString(),
      timeZone: options.timeZone || 'UTC',
    },
    location: options.location,
    attendees: options.attendees?.map((email) => ({ email })),
  };

  // Generate Google Meet link if requested
  if (options.generateMeetLink) {
    event.conferenceData = {
      createRequest: {
        requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    };
  }

  // Add reminders if provided
  if (options.reminders && options.reminders.length > 0) {
    event.reminders = {
      useDefault: false,
      overrides: options.reminders,
    };
  }

  try {
    const response = await client.events.insert({
      calendarId,
      requestBody: event,
      conferenceDataVersion: options.generateMeetLink ? 1 : 0,
      sendUpdates: 'all', // Send email notifications to attendees
    });

    const createdEvent = response.data;
    
    return {
      eventId: createdEvent.id!,
      meetLink: createdEvent.hangoutLink || createdEvent.conferenceData?.entryPoints?.[0]?.uri,
      htmlLink: createdEvent.htmlLink!,
    };
  } catch (error: any) {
    console.error('Error creating Google Calendar event:', error);
    throw new Error(`Failed to create Google Calendar event: ${error.message}`);
  }
}

/**
 * Update a Google Calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  options: Partial<CreateCalendarEventOptions>
): Promise<{ meetLink?: string; htmlLink: string }> {
  const client = initializeCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  // First, get the existing event
  const existingEvent = await client.events.get({
    calendarId,
    eventId,
  });

  if (!existingEvent.data) {
    throw new Error(`Google Calendar event ${eventId} not found`);
  }

  // Update fields
  const updatedEvent: GoogleCalendarEvent = {
    ...existingEvent.data,
    summary: options.summary ?? existingEvent.data.summary,
    description: options.description ?? existingEvent.data.description,
    location: options.location ?? existingEvent.data.location,
    attendees: options.attendees?.map((email) => ({ email })) ?? existingEvent.data.attendees,
  };

  if (options.startTime && options.endTime) {
    updatedEvent.start = {
      dateTime: options.startTime.toISOString(),
      timeZone: options.timeZone || 'UTC',
    };
    updatedEvent.end = {
      dateTime: options.endTime.toISOString(),
      timeZone: options.timeZone || 'UTC',
    };
  }

  // Generate Meet link if requested and not already present
  if (options.generateMeetLink && !existingEvent.data.hangoutLink) {
    updatedEvent.conferenceData = {
      createRequest: {
        requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    };
  }

  // Update reminders if provided
  if (options.reminders && options.reminders.length > 0) {
    updatedEvent.reminders = {
      useDefault: false,
      overrides: options.reminders,
    };
  }

  try {
    const response = await client.events.update({
      calendarId,
      eventId,
      requestBody: updatedEvent,
      conferenceDataVersion: options.generateMeetLink ? 1 : 0,
      sendUpdates: 'all',
    });

    const updated = response.data;
    
    return {
      meetLink: updated.hangoutLink || updated.conferenceData?.entryPoints?.[0]?.uri,
      htmlLink: updated.htmlLink!,
    };
  } catch (error: any) {
    console.error('Error updating Google Calendar event:', error);
    throw new Error(`Failed to update Google Calendar event: ${error.message}`);
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const client = initializeCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  try {
    await client.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'all', // Notify attendees of cancellation
    });
  } catch (error: any) {
    // If event not found, that's okay (might have been deleted externally)
    if (error.code === 404) {
      console.warn(`Google Calendar event ${eventId} not found, skipping delete`);
      return;
    }
    console.error('Error deleting Google Calendar event:', error);
    throw new Error(`Failed to delete Google Calendar event: ${error.message}`);
  }
}

/**
 * Get a Google Calendar event
 */
export async function getCalendarEvent(eventId: string): Promise<{
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  location?: string;
  meetLink?: string;
  htmlLink?: string;
}> {
  const client = initializeCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  try {
    const response = await client.events.get({
      calendarId,
      eventId,
    });

    const event = response.data;
    
    return {
      summary: event.summary,
      description: event.description,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location,
      meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
      htmlLink: event.htmlLink,
    };
  } catch (error: any) {
    if (error.code === 404) {
      throw new Error(`Google Calendar event ${eventId} not found`);
    }
    console.error('Error getting Google Calendar event:', error);
    throw new Error(`Failed to get Google Calendar event: ${error.message}`);
  }
}

/**
 * Generate a Google Meet link for an existing event
 */
export async function generateMeetLinkForEvent(eventId: string): Promise<string> {
  const client = initializeCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  // Get existing event
  const existingEvent = await client.events.get({
    calendarId,
    eventId,
  });

  if (!existingEvent.data) {
    throw new Error(`Google Calendar event ${eventId} not found`);
  }

  // If Meet link already exists, return it
  if (existingEvent.data.hangoutLink) {
    return existingEvent.data.hangoutLink;
  }

  // Add conference data to generate Meet link
  const updatedEvent: GoogleCalendarEvent = {
    ...existingEvent.data,
    conferenceData: {
      createRequest: {
        requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    },
  };

  try {
    const response = await client.events.patch({
      calendarId,
      eventId,
      requestBody: updatedEvent,
      conferenceDataVersion: 1,
    });

    const meetLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri;
    if (!meetLink) {
      throw new Error('Failed to generate Meet link');
    }

    return meetLink;
  } catch (error: any) {
    console.error('Error generating Meet link:', error);
    throw new Error(`Failed to generate Meet link: ${error.message}`);
  }
}
