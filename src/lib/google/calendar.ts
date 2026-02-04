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
  console.log('[Google Calendar] ===== INITIALIZING CALENDAR CLIENT =====');
  
  if (calendarClient && jwtClient) {
    console.log('[Google Calendar] Using cached client');
    // Ensure JWT client is authorized - check if credentials exist and are not expired
    const credentials = jwtClient.credentials;
    if (!credentials || !credentials.access_token) {
      console.log('[Google Calendar] Cached client missing access token, re-authorizing...');
      await jwtClient.authorize();
    } else if (credentials.expiry_date && credentials.expiry_date <= Date.now()) {
      // Token expired, re-authorize
      console.log('[Google Calendar] Cached client token expired, re-authorizing...');
      await jwtClient.authorize();
    } else {
      console.log('[Google Calendar] Using valid cached credentials');
    }
    return calendarClient;
  }

  console.log('[Google Calendar] Creating new client instance');
  
  // Get service account credentials from environment
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;

  console.log(`[Google Calendar] GOOGLE_SERVICE_ACCOUNT_JSON present: ${!!serviceAccountJson}`);
  console.log(`[Google Calendar] GOOGLE_SERVICE_ACCOUNT_PATH present: ${!!serviceAccountPath}`);

  if (!serviceAccountJson && !serviceAccountPath) {
    console.error('[Google Calendar] ERROR: No service account credentials found');
    throw new Error(
      'Google Calendar service account not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PATH environment variable.'
    );
  }

  let credentials: any;
  
  if (serviceAccountJson) {
    console.log('[Google Calendar] Parsing service account JSON from environment variable');
    try {
      // Try parsing as JSON string (for Vercel/production)
      credentials = typeof serviceAccountJson === 'string' 
        ? JSON.parse(serviceAccountJson) 
        : serviceAccountJson;
      console.log('[Google Calendar] Successfully parsed service account JSON');
    } catch (error) {
      console.error('[Google Calendar] ERROR: Failed to parse JSON:', error);
      throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON. Ensure it is valid JSON format.');
    }
  } else if (serviceAccountPath) {
    console.log(`[Google Calendar] Loading service account from file: ${serviceAccountPath}`);
    // Load from file (for local development)
    const fs = require('fs');
    const path = require('path');
    const resolvedPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);
    
    console.log(`[Google Calendar] Resolved file path: ${resolvedPath}`);
    
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[Google Calendar] ERROR: Service account file not found: ${resolvedPath}`);
      throw new Error(`Service account file not found: ${resolvedPath}`);
    }
    
    console.log('[Google Calendar] Reading service account file...');
    credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    console.log('[Google Calendar] Successfully loaded service account from file');
  }
  
  // Log credential details (without sensitive data)
  console.log(`[Google Calendar] Service Account Details:`);
  console.log(`[Google Calendar]   - Project ID: ${credentials.project_id}`);
  console.log(`[Google Calendar]   - Client Email: ${credentials.client_email}`);
  console.log(`[Google Calendar]   - Private Key ID: ${credentials.private_key_id}`);
  console.log(`[Google Calendar]   - Private Key Present: ${!!credentials.private_key}`);
  console.log(`[Google Calendar]   - Private Key Length: ${credentials.private_key?.length || 0} chars`);

  // Handle private key formatting - ensure newlines are properly formatted
  console.log('[Google Calendar] Formatting private key...');
  let privateKey = credentials.private_key;
  if (typeof privateKey === 'string') {
    const originalLength = privateKey.length;
    // Replace escaped newlines with actual newlines if needed
    if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
      console.log('[Google Calendar] Replacing escaped newlines (\\n) with actual newlines');
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    // Also handle double-escaped newlines
    if (privateKey.includes('\\\\n')) {
      console.log('[Google Calendar] Replacing double-escaped newlines (\\\\n) with actual newlines');
      privateKey = privateKey.replace(/\\\\n/g, '\n');
    }
    console.log(`[Google Calendar] Private key formatted: ${originalLength} -> ${privateKey.length} chars`);
  } else {
    console.error('[Google Calendar] ERROR: Private key is not a string');
  }

  // Create JWT client with project_id to ensure proper authentication
  console.log('[Google Calendar] Creating JWT client...');
  console.log(`[Google Calendar]   - Email: ${credentials.client_email}`);
  console.log(`[Google Calendar]   - Project ID: ${credentials.project_id}`);
  console.log(`[Google Calendar]   - Scopes: https://www.googleapis.com/auth/calendar`);
  console.log(`[Google Calendar]   - Subject: undefined (no domain-wide delegation)`);
  
  jwtClient = new JWT({
    email: credentials.client_email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
    projectId: credentials.project_id, // Explicitly set project ID
    subject: undefined, // Don't use domain-wide delegation unless needed
  });
  
  console.log('[Google Calendar] JWT client created successfully');
  
  // Store project ID for error messages
  currentServiceAccountProjectId = credentials.project_id;

  // Authorize the client
  console.log('[Google Calendar] ===== AUTHORIZING SERVICE ACCOUNT =====');
  console.log(`[Google Calendar] Service Account Email: ${credentials.client_email}`);
  console.log(`[Google Calendar] Project ID: ${credentials.project_id}`);
  console.log(`[Google Calendar] Scopes: https://www.googleapis.com/auth/calendar`);
  console.log(`[Google Calendar] Private Key Present: ${!!privateKey}`);
  console.log(`[Google Calendar] Private Key Starts Correctly: ${privateKey?.startsWith('-----BEGIN PRIVATE KEY-----')}`);
  
  try {
    console.log('[Google Calendar] Calling jwtClient.authorize()...');
    console.log('[Google Calendar] JWT Client Config:', {
      email: jwtClient.email,
      projectId: jwtClient.projectId,
      scopes: jwtClient.scopes,
      subject: jwtClient.subject,
    });
    
    const authResult = await jwtClient.authorize();
    console.log('[Google Calendar] Authorization successful!');
    console.log(`[Google Calendar] Auth result type: ${typeof authResult}`);
    console.log(`[Google Calendar] Auth result:`, authResult);
    
    // Verify credentials are set
    if (!jwtClient.credentials) {
      console.error('[Google Calendar] ERROR: jwtClient.credentials is null/undefined');
      throw new Error('Authorization succeeded but credentials object is missing');
    }
    
    if (!jwtClient.credentials.access_token) {
      console.error('[Google Calendar] ERROR: Authorization succeeded but no access token received');
      console.error(`[Google Calendar] Credentials keys: ${Object.keys(jwtClient.credentials).join(', ')}`);
      console.error(`[Google Calendar] Credentials object:`, JSON.stringify(jwtClient.credentials, null, 2));
      throw new Error('Authorization succeeded but no access token received');
    }
    
    console.log(`[Google Calendar] ✓ Access token received: YES`);
    console.log(`[Google Calendar] Access token length: ${jwtClient.credentials.access_token.length} chars`);
    console.log(`[Google Calendar] Access token preview: ${jwtClient.credentials.access_token.substring(0, 30)}...`);
    console.log(`[Google Calendar] Access token ends with: ...${jwtClient.credentials.access_token.substring(jwtClient.credentials.access_token.length - 10)}`);
    
    // Log token expiry for debugging
    if (jwtClient.credentials.expiry_date) {
      const expiryDate = new Date(jwtClient.credentials.expiry_date);
      const now = new Date();
      const minutesUntilExpiry = Math.round((expiryDate.getTime() - now.getTime()) / 1000 / 60);
      console.log(`[Google Calendar] Token expires at: ${expiryDate.toISOString()}`);
      console.log(`[Google Calendar] Token expires in: ${minutesUntilExpiry} minutes`);
      if (minutesUntilExpiry < 0) {
        console.warn('[Google Calendar] WARNING: Token has already expired!');
      }
    } else {
      console.log('[Google Calendar] Token expiry date not set');
    }
    
    console.log(`[Google Calendar] Token type: ${jwtClient.credentials.token_type || 'not specified'}`);
    console.log(`[Google Calendar] Refresh token: ${jwtClient.credentials.refresh_token ? 'Present' : 'Not present'}`);
    console.log('[Google Calendar] ===== AUTHORIZATION COMPLETE =====');
  } catch (error: any) {
    console.error('[Google Calendar] ===== AUTHORIZATION FAILED =====');
    console.error('[Google Calendar] Error type:', error?.constructor?.name);
    console.error('[Google Calendar] Error message:', error?.message);
    console.error('[Google Calendar] Error code:', error?.code);
    console.error('[Google Calendar] Error response status:', error?.response?.status);
    console.error('[Google Calendar] Error response data:', JSON.stringify(error?.response?.data || {}, null, 2));
    console.error('[Google Calendar] Error response headers:', JSON.stringify(error?.response?.headers || {}, null, 2));
    console.error('[Google Calendar] Full error:', error);
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
  console.log('[Google Calendar] ===== INITIALIZING CALENDAR API CLIENT =====');
  console.log(`[Google Calendar] API Version: v3`);
  console.log(`[Google Calendar] Using authenticated JWT client`);
  
  calendarClient = google.calendar({ 
    version: 'v3', 
    auth: jwtClient as any,
  });
  
  console.log(`[Google Calendar] Calendar API client created successfully`);
  console.log(`[Google Calendar] Project: ${credentials.project_id}`);
  console.log(`[Google Calendar] Service Account: ${credentials.client_email}`);
  console.log('[Google Calendar] ===== CLIENT INITIALIZATION COMPLETE =====');
  
  return calendarClient;

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
  console.log('[Google Calendar] ===== LISTING CALENDAR EVENTS =====');
  console.log(`[Google Calendar] Time range: ${timeMin?.toISOString()} to ${timeMax?.toISOString()}`);
  console.log(`[Google Calendar] Max results: ${maxResults}`);
  
  const client = await initializeCalendarClient();
  const calendarId = getCalendarId();

  console.log(`[Google Calendar] Target calendar ID: "${calendarId}"`);

  // Verify authentication before making API call
  console.log('[Google Calendar] ===== VERIFYING AUTHENTICATION BEFORE API CALL =====');
  if (!jwtClient) {
    console.error('[Google Calendar] ERROR: jwtClient is null/undefined!');
    throw new Error('JWT client not initialized');
  }
  
  console.log(`[Google Calendar] JWT client exists: YES`);
  console.log(`[Google Calendar] JWT client email: ${jwtClient.email}`);
  console.log(`[Google Calendar] JWT client project ID: ${jwtClient.projectId}`);
  
  if (!jwtClient.credentials) {
    console.error('[Google Calendar] ERROR: jwtClient.credentials is null/undefined!');
    console.error('[Google Calendar] Attempting to re-authorize...');
    try {
      await jwtClient.authorize();
      console.log('[Google Calendar] Re-authorization successful');
    } catch (reauthError: any) {
      console.error('[Google Calendar] Re-authorization failed:', reauthError?.message);
      throw new Error('JWT client credentials missing and re-authorization failed');
    }
  }
  
  console.log(`[Google Calendar] Credentials object exists: YES`);
  console.log(`[Google Calendar] Access token present: ${jwtClient.credentials?.access_token ? 'YES' : 'NO'}`);
  
  if (jwtClient.credentials?.access_token) {
    console.log(`[Google Calendar] ✓ Access token length: ${jwtClient.credentials.access_token.length} chars`);
    console.log(`[Google Calendar] Access token preview: ${jwtClient.credentials.access_token.substring(0, 30)}...`);
    
    // Check if token is expired
    if (jwtClient.credentials.expiry_date) {
      const expiryDate = new Date(jwtClient.credentials.expiry_date);
      const now = new Date();
      if (expiryDate <= now) {
        console.warn('[Google Calendar] WARNING: Access token has expired! Re-authorizing...');
        await jwtClient.authorize();
        console.log('[Google Calendar] Re-authorization after expiry successful');
      }
    }
  } else {
    console.error('[Google Calendar] ERROR: No access token available!');
    throw new Error('Access token missing from credentials');
  }
  
  console.log(`[Google Calendar] Token type: ${jwtClient.credentials.token_type || 'not specified'}`);
  console.log('[Google Calendar] ===== AUTHENTICATION VERIFIED =====');

  try {
    console.log('[Google Calendar] ===== MAKING API CALL =====');
    console.log(`[Google Calendar] API Endpoint: calendar.events.list`);
    console.log(`[Google Calendar] Request parameters:`, {
      calendarId,
      timeMin: timeMin?.toISOString(),
      timeMax: timeMax?.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const response = await client.events.list({
      calendarId,
      timeMin: timeMin?.toISOString(),
      timeMax: timeMax?.toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    console.log('[Google Calendar] ===== API CALL SUCCESSFUL =====');
    console.log(`[Google Calendar] Response status: ${response.status || 'unknown'}`);
    console.log(`[Google Calendar] Response headers:`, JSON.stringify(response.headers || {}, null, 2));
    
    const eventCount = response.data.items?.length || 0;
    console.log(`[Google Calendar] Events found: ${eventCount}`);
    console.log(`[Google Calendar] Calendar timezone: ${response.data.timeZone || 'not specified'}`);
    console.log(`[Google Calendar] Calendar summary: ${response.data.summary || 'not specified'}`);
    
    if (eventCount === 0) {
      console.warn(`[Google Calendar] WARNING: No events found in calendar "${calendarId}"`);
      console.warn(`[Google Calendar] This could mean:`);
      console.warn(`[Google Calendar]   1. Calendar is empty`);
      console.warn(`[Google Calendar]   2. Calendar ID is incorrect`);
      console.warn(`[Google Calendar]   3. Calendar is not shared with service account`);
      console.warn(`[Google Calendar]   4. Time range doesn't match any events`);
    } else {
      console.log(`[Google Calendar] First event:`, response.data.items?.[0]?.summary || 'N/A');
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
    console.error('[Google Calendar] ===== API CALL FAILED =====');
    console.error('[Google Calendar] Error type:', error?.constructor?.name || typeof error);
    console.error('[Google Calendar] Error message:', error?.message);
    console.error('[Google Calendar] Error code:', error?.code);
    console.error('[Google Calendar] Error status:', error?.response?.status);
    console.error('[Google Calendar] Error status text:', error?.response?.statusText);
    console.error('[Google Calendar] Error response data:', JSON.stringify(error?.response?.data || {}, null, 2));
    console.error('[Google Calendar] Error response headers:', JSON.stringify(error?.response?.headers || {}, null, 2));
    console.error('[Google Calendar] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    const errorMessage = error?.message || String(error);
    
    // Provide specific guidance for common errors
    if (errorMessage.includes('unregistered callers') || errorMessage.includes('API Key')) {
      const projectId = currentServiceAccountProjectId || 'unknown';
      console.error(`[Google Calendar] DIAGNOSIS: Unregistered callers error`);
      console.error(`[Google Calendar]   - Project ID: ${projectId}`);
      console.error(`[Google Calendar]   - Service Account: ${jwtClient?.email || 'unknown'}`);
      console.error(`[Google Calendar]   - Access Token Present: ${jwtClient?.credentials?.access_token ? 'YES' : 'NO'}`);
      console.error(`[Google Calendar]   - Enable API: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=${projectId}`);
      throw new Error(
        `Failed to list Google Calendar events: ${errorMessage}. ` +
        `Ensure the Google Calendar API is enabled in Google Cloud Console for project "${projectId}". ` +
        `Enable API here: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=${projectId}`
      );
    } else if (error.code === 403) {
      console.error(`[Google Calendar] DIAGNOSIS: Access denied (403)`);
      console.error(`[Google Calendar]   - Calendar ID: ${calendarId}`);
      console.error(`[Google Calendar]   - Service Account: ${jwtClient?.email || 'unknown'}`);
      throw new Error(
        `Access denied (403): ${errorMessage}. ` +
        `Check that the calendar "${calendarId}" is shared with the service account email.`
      );
    } else if (error.code === 404) {
      console.error(`[Google Calendar] DIAGNOSIS: Calendar not found (404)`);
      console.error(`[Google Calendar]   - Calendar ID: ${calendarId}`);
      throw new Error(
        `Calendar not found (404): Calendar "${calendarId}" does not exist or is not accessible. ` +
        `Verify the calendar ID is correct.`
      );
    }
    
    console.error('[Google Calendar] ===== ERROR HANDLING COMPLETE =====');
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
