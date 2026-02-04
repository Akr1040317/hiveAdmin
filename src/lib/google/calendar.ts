import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

let calendarClient: any = null;
let jwtClient: JWT | null = null;
let currentServiceAccountProjectId: string | null = null;

/**
 * Get Google Calendar ID from environment variable, trimming whitespace
 */
function getCalendarId(): string {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  // Trim whitespace and newlines to handle Vercel env var formatting issues
  return calendarId.trim();
}

/**
 * Initialize Google Calendar API client using service account
 */
async function initializeCalendarClient() {
  if (calendarClient && jwtClient) {
    // Ensure JWT client is authorized - check if credentials exist and are not expired
    const credentials = jwtClient.credentials;
    if (!credentials || !credentials.access_token) {
      await jwtClient.authorize();
    } else if (credentials.expiry_date && credentials.expiry_date <= Date.now()) {
      // Token expired, re-authorize
      await jwtClient.authorize();
    }
    return calendarClient;
  }

  // Get service account credentials from environment
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountJson && !serviceAccountPath) {
    throw new Error(
      'Google Calendar service account not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PATH environment variable.'
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
      throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON. Ensure it is valid JSON format.');
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

  // Handle private key formatting - ensure newlines are properly formatted
  let privateKey = credentials.private_key;
  if (typeof privateKey === 'string') {
    // Replace escaped newlines with actual newlines if needed
    if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    // Also handle double-escaped newlines
    if (privateKey.includes('\\\\n')) {
      privateKey = privateKey.replace(/\\\\n/g, '\n');
    }
  }

  // Create JWT client with project_id to ensure proper authentication
  jwtClient = new JWT({
    email: credentials.client_email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    projectId: credentials.project_id, // Explicitly set project ID
    subject: undefined, // Don't use domain-wide delegation unless needed
  });
  
  console.log(`[Google Calendar] Initializing service account: ${credentials.client_email}`);
  console.log(`[Google Calendar] Project ID: ${credentials.project_id}`);
  console.log(`[Google Calendar] Scopes: https://www.googleapis.com/auth/calendar`);
  
  // Store project ID for error messages
  currentServiceAccountProjectId = credentials.project_id;

  // Authorize the client
  try {
    const authResult = await jwtClient.authorize();
    console.log('[Google Calendar] Service account authorized successfully');
    console.log(`[Google Calendar] Access token received: ${jwtClient.credentials?.access_token ? 'Yes' : 'No'}`);
    
    // Verify credentials are set
    if (!jwtClient.credentials || !jwtClient.credentials.access_token) {
      throw new Error('Authorization succeeded but no access token received');
    }
    
    // Log token expiry for debugging
    if (jwtClient.credentials.expiry_date) {
      const expiryDate = new Date(jwtClient.credentials.expiry_date);
      console.log(`[Google Calendar] Token expires at: ${expiryDate.toISOString()}`);
    }
  } catch (error: any) {
    console.error('Failed to authorize Google Calendar JWT client:', error);
    const errorMessage = error?.message || String(error);
    
    // Provide more helpful error messages
    if (errorMessage.includes('invalid_grant') || errorMessage.includes('unauthorized')) {
      throw new Error(
        `Failed to authorize Google Calendar service account: ${errorMessage}. ` +
        `Check that the service account email (${credentials.client_email}) has access to the calendar. ` +
        `Share the calendar with this email address in Google Calendar settings.`
      );
    } else if (errorMessage.includes('API') || errorMessage.includes('not enabled')) {
      throw new Error(
        `Google Calendar API not enabled or accessible: ${errorMessage}. ` +
        `Enable the Google Calendar API in Google Cloud Console for project ${credentials.project_id || 'unknown'}.`
      );
    } else {
      throw new Error(`Failed to authorize Google Calendar service account: ${errorMessage}`);
    }
  }

  // Initialize Calendar API with authenticated JWT client
  // Explicitly set the project ID to ensure API calls are associated with the correct project
  calendarClient = google.calendar({ 
    version: 'v3', 
    auth: jwtClient as any,
  });
  
  console.log(`[Google Calendar] Calendar API client initialized for project: ${credentials.project_id}`);
  console.log(`[Google Calendar] Service account email: ${credentials.client_email}`);

  // Verify the client is properly initialized
  if (!calendarClient) {
    throw new Error('Failed to initialize Google Calendar client');
  }

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

export interface GoogleCalendarEventData {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  hangoutLink?: string;
  htmlLink?: string;
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
  const client = await initializeCalendarClient();
  const calendarId = getCalendarId();

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
  const client = await initializeCalendarClient();
  const calendarId = getCalendarId();

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
  const client = await initializeCalendarClient();
  const calendarId = getCalendarId();

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
  const client = await initializeCalendarClient();
  const calendarId = getCalendarId();

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
 * List calendars accessible by the service account
 * Useful for debugging to see which calendars are available
 */
export async function listCalendars(): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
  const client = await initializeCalendarClient();
  
  try {
    const response = await client.calendarList.list();
    const calendars = (response.data.items || []).map((cal: any) => ({
      id: cal.id,
      summary: cal.summary || 'Untitled Calendar',
      primary: cal.primary || false,
    }));
    console.log('[Google Calendar] Available calendars:', calendars);
    return calendars;
  } catch (error: any) {
    console.error('[Google Calendar] Failed to list calendars:', error);
    throw error;
  }
}

/**
 * List Google Calendar events
 */
export async function listGoogleCalendarEvents(
  timeMin?: Date,
  timeMax?: Date,
  maxResults: number = 250
): Promise<GoogleCalendarEventData[]> {
  const client = await initializeCalendarClient();
  const calendarId = getCalendarId();

  // Log which calendar we're accessing for debugging
  console.log(`[Google Calendar] Accessing calendar: "${calendarId}"`);

  try {
    // Log authentication state before making API call
    if (jwtClient && jwtClient.credentials) {
      console.log(`[Google Calendar] Making API call with access token: ${jwtClient.credentials.access_token ? 'Present' : 'Missing'}`);
    }
    
    const response = await client.events.list({
      calendarId,
      timeMin: timeMin?.toISOString(),
      timeMax: timeMax?.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const eventCount = response.data.items?.length || 0;
    console.log(`[Google Calendar] Found ${eventCount} events in calendar "${calendarId}"`);
    
    if (eventCount === 0) {
      console.warn(`[Google Calendar] No events found. Make sure calendar "${calendarId}" is correct and shared with the service account.`);
    }

    const events = response.data.items || [];
    
    return events.map((event: any) => ({
      id: event.id!,
      summary: event.summary || 'Untitled Event',
      description: event.description,
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      location: event.location,
      attendees: event.attendees?.map((a: any) => a.email).filter(Boolean),
      hangoutLink: event.hangoutLink,
      htmlLink: event.htmlLink,
    }));
  } catch (error: any) {
    console.error('Error listing Google Calendar events:', error);
    const errorMessage = error?.message || String(error);
    
    // Provide specific guidance for common errors
    if (errorMessage.includes('unregistered callers') || errorMessage.includes('API Key')) {
      const projectId = currentServiceAccountProjectId || 'unknown';
      throw new Error(
        `Failed to list Google Calendar events: ${errorMessage}. ` +
        `Ensure the Google Calendar API is enabled in Google Cloud Console for project "${projectId}". ` +
        `Enable API here: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=${projectId}`
      );
    } else if (error.code === 403) {
      throw new Error(
        `Access denied (403): ${errorMessage}. ` +
        `Check that the calendar "${calendarId}" is shared with the service account email.`
      );
    } else if (error.code === 404) {
      throw new Error(
        `Calendar not found (404): Calendar "${calendarId}" does not exist or is not accessible. ` +
        `Verify the calendar ID is correct.`
      );
    }
    
    throw new Error(`Failed to list Google Calendar events: ${errorMessage}`);
  }
}

/**
 * Generate a Google Meet link for an existing event
 */
export async function generateMeetLinkForEvent(eventId: string): Promise<string> {
  const client = await initializeCalendarClient();
  const calendarId = getCalendarId();

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
