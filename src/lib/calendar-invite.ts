import { Meeting } from '@/app/actions/meetings';
import { format } from 'date-fns';

/**
 * Generate RFC 5545 compliant .ics file content for a meeting
 * @param meeting The meeting object
 * @param attendees Array of email addresses to invite
 * @param organizerEmail Email of the meeting organizer (default: arastogi@hivespelling.com)
 * @returns .ics file content as string
 */
export function generateICSFile(
  meeting: Meeting,
  attendees: string[],
  organizerEmail: string = 'arastogi@hivespelling.com'
): string {
  const startDate = new Date(meeting.startsAt);
  const durationMinutes = meeting.duration || 60;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  // Format dates in UTC for .ics (YYYYMMDDTHHmmssZ)
  const formatICSDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };

  // Generate unique ID for the event
  const uid = `${meeting.id}@hiveadmin.hivespelling.com`;

  // Escape text for .ics format (escape commas, semicolons, backslashes, newlines)
  const escapeICS = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  // Build .ics content
  let icsContent = 'BEGIN:VCALENDAR\r\n';
  icsContent += 'VERSION:2.0\r\n';
  icsContent += 'PRODID:-//Hive Admin//Meeting Invite//EN\r\n';
  icsContent += 'CALSCALE:GREGORIAN\r\n';
  icsContent += 'METHOD:REQUEST\r\n';
  icsContent += 'BEGIN:VEVENT\r\n';
  icsContent += `UID:${uid}\r\n`;
  icsContent += `DTSTAMP:${formatICSDate(new Date())}\r\n`;
  icsContent += `DTSTART:${formatICSDate(startDate)}\r\n`;
  icsContent += `DTEND:${formatICSDate(endDate)}\r\n`;
  icsContent += `SUMMARY:${escapeICS(meeting.title)}\r\n`;

  // Add description (agenda + notes)
  let description = '';
  if (meeting.agenda) {
    description += `Agenda: ${meeting.agenda}`;
  }
  if (meeting.notes) {
    if (description) description += '\\n\\n';
    description += `Notes: ${meeting.notes}`;
  }
  if (description) {
    icsContent += `DESCRIPTION:${escapeICS(description)}\r\n`;
  }

  // Add location if provided
  if (meeting.location) {
    icsContent += `LOCATION:${escapeICS(meeting.location)}\r\n`;
  }

  // Add organizer
  icsContent += `ORGANIZER;CN=${escapeICS(organizerEmail.split('@')[0])}:MAILTO:${organizerEmail}\r\n`;

  // Add attendees
  attendees.forEach((attendee) => {
    if (attendee && attendee.includes('@')) {
      const attendeeName = attendee.split('@')[0];
      icsContent += `ATTENDEE;CN=${escapeICS(attendeeName)};RSVP=TRUE:MAILTO:${attendee}\r\n`;
    }
  });

  // Add status
  icsContent += 'STATUS:CONFIRMED\r\n';
  icsContent += 'SEQUENCE:0\r\n';
  icsContent += 'END:VEVENT\r\n';
  icsContent += 'END:VCALENDAR\r\n';

  return icsContent;
}

/**
 * Generate a simple .ics file for calendar items (deadlines, milestones, etc.)
 * @param title Event title
 * @param date Event date
 * @param time Optional time (HH:mm format)
 * @param notes Optional notes/description
 * @param location Optional location
 * @param attendees Array of email addresses
 * @returns .ics file content as string
 */
export function generateCalendarItemICS(
  title: string,
  date: Date,
  time?: string,
  notes?: string,
  location?: string,
  attendees: string[] = [],
  organizerEmail: string = 'arastogi@hivespelling.com'
): string {
  // Parse time if provided
  let startDate = new Date(date);
  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    startDate.setHours(hours, minutes || 0, 0, 0);
  } else {
    // Default to 9 AM if no time specified
    startDate.setHours(9, 0, 0, 0);
  }

  // Default duration: 1 hour for events, all day for deadlines/milestones
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatICSDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  };

  const uid = `${Date.now()}-${Math.random().toString(36).substring(7)}@hiveadmin.hivespelling.com`;

  const escapeICS = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  let icsContent = 'BEGIN:VCALENDAR\r\n';
  icsContent += 'VERSION:2.0\r\n';
  icsContent += 'PRODID:-//Hive Admin//Calendar Event//EN\r\n';
  icsContent += 'CALSCALE:GREGORIAN\r\n';
  icsContent += 'METHOD:REQUEST\r\n';
  icsContent += 'BEGIN:VEVENT\r\n';
  icsContent += `UID:${uid}\r\n`;
  icsContent += `DTSTAMP:${formatICSDate(new Date())}\r\n`;
  icsContent += `DTSTART:${formatICSDate(startDate)}\r\n`;
  icsContent += `DTEND:${formatICSDate(endDate)}\r\n`;
  icsContent += `SUMMARY:${escapeICS(title)}\r\n`;

  if (notes) {
    icsContent += `DESCRIPTION:${escapeICS(notes)}\r\n`;
  }

  if (location) {
    icsContent += `LOCATION:${escapeICS(location)}\r\n`;
  }

  icsContent += `ORGANIZER;CN=${escapeICS(organizerEmail.split('@')[0])}:MAILTO:${organizerEmail}\r\n`;

  attendees.forEach((attendee) => {
    if (attendee && attendee.includes('@')) {
      const attendeeName = attendee.split('@')[0];
      icsContent += `ATTENDEE;CN=${escapeICS(attendeeName)};RSVP=TRUE:MAILTO:${attendee}\r\n`;
    }
  });

  icsContent += 'STATUS:CONFIRMED\r\n';
  icsContent += 'SEQUENCE:0\r\n';
  icsContent += 'END:VEVENT\r\n';
  icsContent += 'END:VCALENDAR\r\n';

  return icsContent;
}
