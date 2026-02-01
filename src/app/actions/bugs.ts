'use server';

import { requireAuth } from '@/lib/firebase/server-auth';
import {
  getCollectionData,
  getDocumentData,
  createDocument,
  updateDocument,
  deleteDocument,
  queryCollection,
  queryTopLevelCollection,
  updateTopLevelDocument,
  getTopLevelCollection,
  getCollection,
} from '@/lib/firebase/data-access';
import { ProjectId, getProject } from '@/lib/projects';
import { format } from 'date-fns';
import { serializeForClient } from '@/lib/utils/serialize';

export interface Bug {
  id: string;
  title: string;
  description: string;
  platform: 'ios' | 'web' | 'admin' | 'backend';
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'reported' | 'in_progress' | 'blocked' | 'fixed' | 'verified';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  assignedTo?: string; // Email address of assigned user
  tags?: string[];
  order?: number; // For board view ordering
  convertedFromReportId?: string; // Track if bug was converted from a report
  dueDate?: Date; // Target completion date
  completionDate?: Date; // Actual completion date
  notes?: string; // Internal notes/observations
  stepsToReproduce?: string; // How to reproduce the bug
  expectedBehavior?: string; // What should happen
  actualBehavior?: string; // What actually happens
  lastEmailSent?: Date; // Last time an email was sent to the reporter
  lastEmailSubject?: string; // Subject of the last email sent
}

export async function getBugs(projectId: ProjectId, token?: string | null): Promise<Bug[]> {
  await requireAuth(token);
  const bugs = await getCollectionData<Bug>(projectId, 'bugs');
  
  // Recursively serialize all Date objects and non-serializable values
  return serializeForClient(bugs) as Bug[];
}

export async function getBug(projectId: ProjectId, bugId: string, token?: string | null): Promise<Bug | null> {
  await requireAuth(token);
  const bug = await getDocumentData<Bug>(projectId, 'bugs', bugId);
  if (!bug) return null;
  
  // Recursively serialize all Date objects and non-serializable values
  return serializeForClient(bug) as Bug;
}

export async function createBug(
  projectId: ProjectId,
  data: Omit<Bug, 'id' | 'createdAt' | 'updatedAt'>,
  token?: string | null
): Promise<string> {
  const user = await requireAuth(token);
  
  const bugData = {
    ...data,
    createdBy: user.email || 'unknown',
  };
  
  return createDocument<Bug>(projectId, 'bugs', bugData);
}

export async function updateBug(
  projectId: ProjectId,
  bugId: string,
  data: Partial<Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>>,
  token?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Only send emails for prepcenter-uae
  const project = getProject(projectId);
  const shouldSendEmails = project?.id === 'prepcenter-uae';
  
  if (shouldSendEmails) {
    // Get previous data to detect changes
    const previousData = await getDocumentData<Bug>(projectId, 'bugs', bugId);
    
    // Detect key changes
    const changes: string[] = [];
    const newAssignedTo = data.assignedTo !== undefined ? data.assignedTo : previousData?.assignedTo;
    const oldAssignedTo = previousData?.assignedTo;
    
    if (data.assignedTo !== undefined && data.assignedTo !== oldAssignedTo) {
      changes.push('assignment');
    }
    if (data.status !== undefined && data.status !== previousData?.status) {
      changes.push('status');
    }
    if (data.severity !== undefined && data.severity !== previousData?.severity) {
      changes.push('severity');
    }
    if (data.dueDate !== undefined) {
      const newDueDate = data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : null;
      const oldDueDate = previousData?.dueDate ? new Date(previousData.dueDate).toISOString().split('T')[0] : null;
      if (newDueDate !== oldDueDate) {
        changes.push('dueDate');
      }
    }
    
    // Send email if there are changes and there's an assignee
    if (changes.length > 0 && newAssignedTo) {
      try {
        const statusLabels: Record<string, string> = {
          reported: 'Reported',
          in_progress: 'In Progress',
          blocked: 'Blocked',
          fixed: 'Fixed',
          verified: 'Verified',
        };
        
        const severityLabels: Record<string, string> = {
          critical: 'Critical',
          high: 'High',
          medium: 'Medium',
          low: 'Low',
        };
        
        // Build email body
        let emailBody = `Hello,\n\n`;
        
        if (changes.includes('assignment')) {
          if (oldAssignedTo) {
            emailBody += `You have been reassigned to this bug.\n\n`;
          } else {
            emailBody += `You have been assigned to this bug.\n\n`;
          }
        }
        
        emailBody += `Bug: ${previousData?.title || 'Untitled Bug'}\n`;
        emailBody += `Description: ${previousData?.description || 'No description'}\n\n`;
        
        if (changes.includes('status')) {
          emailBody += `Status changed to: ${statusLabels[data.status as string] || data.status}\n`;
        } else {
          emailBody += `Status: ${statusLabels[previousData?.status || 'reported']}\n`;
        }
        
        if (changes.includes('severity')) {
          emailBody += `Severity changed to: ${severityLabels[data.severity as string] || data.severity}\n`;
        } else {
          emailBody += `Severity: ${severityLabels[previousData?.severity || 'medium']}\n`;
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
        emailBody += `View this bug in the admin panel for more details.\n`;
        
        const subject = changes.includes('assignment') && !oldAssignedTo
          ? `You've been assigned to: ${previousData?.title || 'Bug'}`
          : `Update: ${previousData?.title || 'Bug'}`;
        
        await sendBugUpdateEmail(projectId, bugId, subject, emailBody, token, newAssignedTo);
      } catch (error) {
        // Log error but don't fail the update
        console.error('Failed to send bug update email:', error);
      }
    }
  }
  
  return updateDocument<Bug>(projectId, 'bugs', bugId, data);
}

export async function deleteBug(projectId: ProjectId, bugId: string, token?: string | null): Promise<void> {
  await requireAuth(token);
  return deleteDocument(projectId, 'bugs', bugId);
}

export async function getBugsByStatus(
  projectId: ProjectId,
  status: Bug['status'],
  token?: string | null
): Promise<Bug[]> {
  await requireAuth(token);
  return queryCollection<Bug>(projectId, 'bugs', (query) =>
    query.where('status', '==', status)
  );
}

export async function getBugsByPlatform(
  projectId: ProjectId,
  platform: Bug['platform'],
  token?: string | null
): Promise<Bug[]> {
  await requireAuth(token);
  return queryCollection<Bug>(projectId, 'bugs', (query) =>
    query.where('platform', '==', platform)
  );
}

/**
 * Feedback Report from feedbackAndBugs collection
 * 
 * NOTE: This structure is specific to prepcenter projects (prepcenter-oman, prepcenter-uae).
 * Other projects (e.g., hive-learner) will have different data sources and document structures.
 * The feedbackAndBugs collection exists at the root level of the prepcenter Firebase project.
 * 
 * Timestamp fields are returned as ISO strings from server actions for proper serialization.
 */
export interface FeedbackReport {
  id: string;
  type: 'bug_report' | string;
  subject: string;
  description: string;
  email: string;
  name: string;
  bugType: string;
  severity: string;
  status: string;
  device: string;
  browser: string;
  actualBehavior: string;
  expectedBehavior: string;
  stepsToReproduce: string;
  timestamp: string; // ISO string when returned from server actions
  updatedAt: string; // ISO string when returned from server actions
  lastEmailSent?: string; // ISO string when returned from server actions
  lastEmailSubject?: string;
  convertedToBugId?: string; // Track conversion
}

/**
 * Parse severity string to bug severity enum
 */
function parseSeverity(severity: string): Bug['severity'] {
  const lower = severity.toLowerCase();
  if (lower.includes('critical')) return 'critical';
  if (lower.includes('high')) return 'high';
  if (lower.includes('medium')) return 'medium';
  if (lower.includes('low')) return 'low';
  // Default based on common patterns
  if (lower.includes('affects functionality')) return 'high';
  return 'medium';
}

/**
 * Map bugType to platform enum
 */
function mapBugTypeToPlatform(bugType: string): Bug['platform'] {
  const lower = bugType.toLowerCase();
  if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) return 'ios';
  if (lower.includes('admin')) return 'admin';
  if (lower.includes('backend') || lower.includes('server') || lower.includes('api')) return 'backend';
  return 'web'; // Default to web
}

/**
 * Map report status to bug status
 */
function mapStatusToBugStatus(status: string): Bug['status'] {
  const lower = status.toLowerCase();
  if (lower === 'completed' || lower === 'resolved' || lower === 'fixed') return 'fixed';
  if (lower === 'in progress' || lower === 'in-progress') return 'in_progress';
  if (lower === 'blocked' || lower === 'on hold') return 'blocked';
  if (lower === 'verified') return 'verified';
  return 'reported'; // Default
}

/**
 * Convert Firestore timestamp to Date
 */
function toDate(value: Date | { seconds: number; nanoseconds: number } | string | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000);
  }
  return new Date();
}

/**
 * Convert Firestore timestamp to ISO string for serialization
 */
function toISOString(value: Date | { seconds: number; nanoseconds: number } | string | undefined): string {
  const date = toDate(value);
  return date.toISOString();
}

/**
 * Serialize a date field from Firestore to ISO string for client serialization
 */
function serializeDateField(value: any): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    // Already a string, validate it's a valid date string
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date().toISOString() : value;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    // Firestore Timestamp
    return new Date((value as any).seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Get unconverted feedback reports from feedbackAndBugs collection
 * 
 * NOTE: This function is specific to prepcenter projects only.
 * The feedbackAndBugs collection structure and location is prepcenter-specific.
 * Other projects will need their own implementation with different data sources.
 */
export async function getFeedbackReports(
  projectId: ProjectId,
  token?: string | null
): Promise<FeedbackReport[]> {
  await requireAuth(token);
  
  // Only fetch for prepcenter projects (prepcenter-oman, prepcenter-uae)
  // Other projects have different data sources and structures
  const project = getProject(projectId);
  if (project?.firebaseProjectType !== 'prepcenter') {
    return [];
  }
  
  // Query for bug reports that haven't been converted yet
  // Note: Firestore doesn't support != null, so we query for type and then filter client-side
  const allReports = await queryTopLevelCollection<FeedbackReport>(
    projectId,
    'feedbackAndBugs',
    (query) => query.where('type', '==', 'bug_report')
  );
  
  // Filter out converted reports and recursively serialize all Date objects
  const filtered = allReports.filter(report => !report.convertedToBugId);
  return serializeForClient(filtered) as FeedbackReport[];
}

/**
 * Convert a feedback report to a bug ticket
 * 
 * NOTE: This function is specific to prepcenter projects only.
 * It converts reports from the feedbackAndBugs collection (prepcenter structure)
 * to bug tickets in the projects/{projectId}/bugs collection.
 * Other projects will need their own conversion logic for their specific data structures.
 */
export async function convertReportToBug(
  projectId: ProjectId,
  reportId: string,
  token?: string | null
): Promise<string> {
  const user = await requireAuth(token);
  
  // Get the report
  const collection = await getTopLevelCollection(projectId, 'feedbackAndBugs');
  const reportDoc = await collection.doc(reportId).get();
  
  if (!reportDoc.exists) {
    throw new Error(`Feedback report ${reportId} not found`);
  }
  
  const reportData = reportDoc.data();
  // Convert Firestore Timestamps to ISO strings for consistency
  const report: FeedbackReport = {
    id: reportDoc.id,
    ...reportData,
    timestamp: toISOString(reportData?.timestamp),
    updatedAt: toISOString(reportData?.updatedAt),
    lastEmailSent: reportData?.lastEmailSent ? toISOString(reportData.lastEmailSent) : undefined,
  } as FeedbackReport;
  
  // Check if already converted
  if (report.convertedToBugId) {
    throw new Error(`Report ${reportId} has already been converted to bug ${report.convertedToBugId}`);
  }
  
  // Map report fields to bug fields
  // Always set status to 'reported' (New) when converting, so it appears in the New column
  const bugData: Omit<Bug, 'id' | 'createdAt' | 'updatedAt'> = {
    title: report.subject || 'Untitled Bug',
    description: report.description || '',
    platform: mapBugTypeToPlatform(report.bugType),
    severity: parseSeverity(report.severity),
    status: 'reported', // Always start as 'reported' (New column) when converting
    createdBy: report.email || user.email || 'unknown',
    tags: [],
    order: 0,
    // Populate new fields from report data
    stepsToReproduce: report.stepsToReproduce && report.stepsToReproduce !== 'Not provided' ? report.stepsToReproduce : undefined,
    expectedBehavior: report.expectedBehavior && report.expectedBehavior !== 'Not provided' ? report.expectedBehavior : undefined,
    actualBehavior: report.actualBehavior && report.actualBehavior !== 'Not provided' ? report.actualBehavior : undefined,
  };
  
  // Create the bug with custom timestamps (preserve original report timestamps)
  // report.timestamp and report.updatedAt are ISO strings from getFeedbackReports
  const bugsCollection = await getCollection(projectId, 'bugs');
  const reportTimestamp = new Date(report.timestamp);
  const reportUpdatedAt = new Date(report.updatedAt);
  
  const docRef = await bugsCollection.add({
    ...bugData,
    createdAt: reportTimestamp,
    updatedAt: reportUpdatedAt,
    convertedFromReportId: reportId, // Track which report this bug came from
  });
  
  const bugId = docRef.id;
  
  // Mark report as converted
  await updateTopLevelDocument(projectId, 'feedbackAndBugs', reportId, {
    convertedToBugId: bugId,
  });
  
  return bugId;
}

/**
 * Unconvert a bug back to a report
 * This deletes the bug and clears the convertedToBugId on the original report
 * 
 * NOTE: This function is specific to prepcenter projects only.
 */
export async function unconvertBugToReport(
  projectId: ProjectId,
  bugId: string,
  token?: string | null
): Promise<void> {
  const user = await requireAuth(token);
  
  // Get the bug
  const bug = await getDocumentData<Bug>(projectId, 'bugs', bugId);
  if (!bug) {
    throw new Error(`Bug ${bugId} not found`);
  }
  
  // Find the report ID - check bug field first, then search reports
  let reportId: string | null = bug.convertedFromReportId || null;
  
  // If not found in bug, search for report with this bug ID
  if (!reportId) {
    const project = getProject(projectId);
    if (project?.firebaseProjectType === 'prepcenter') {
      try {
        const allReports = await queryTopLevelCollection<FeedbackReport>(
          projectId,
          'feedbackAndBugs',
          (query) => query.where('type', '==', 'bug_report')
        );
        
        const matchingReport = allReports.find(report => report.convertedToBugId === bugId);
        reportId = matchingReport ? matchingReport.id : null;
      } catch (error) {
        console.error('Error searching for report:', error);
      }
    }
  }
  
  if (!reportId) {
    throw new Error(`Bug ${bugId} was not converted from a report`);
  }
  
  // Delete the bug
  await deleteDocument(projectId, 'bugs', bugId);
  
  // Clear the convertedToBugId on the report so it shows up in pending_reports again
  await updateTopLevelDocument(projectId, 'feedbackAndBugs', reportId, {
    convertedToBugId: null,
  });
}

/**
 * Check if a bug was converted from a report
 * This checks both the bug's convertedFromReportId field and searches for reports with matching convertedToBugId
 */
export async function isBugConvertedFromReport(
  projectId: ProjectId,
  bugId: string,
  token?: string | null
): Promise<string | null> {
  await requireAuth(token);
  
  // Get the bug
  const bug = await getDocumentData<Bug>(projectId, 'bugs', bugId);
  if (!bug) {
    return null;
  }
  
  // Check if bug has convertedFromReportId field (new way)
  if (bug.convertedFromReportId) {
    return bug.convertedFromReportId;
  }
  
  // Fallback: Check if any report has this bug ID as convertedToBugId (old way)
  const project = getProject(projectId);
  if (project?.firebaseProjectType !== 'prepcenter') {
    return null;
  }
  
  try {
    const allReports = await queryTopLevelCollection<FeedbackReport>(
      projectId,
      'feedbackAndBugs',
      (query) => query.where('type', '==', 'bug_report')
    );
    
    const matchingReport = allReports.find(report => report.convertedToBugId === bugId);
    return matchingReport ? matchingReport.id : null;
  } catch (error) {
    console.error('Error checking if bug was converted:', error);
    return null;
  }
}

/**
 * Generate an email using AI for a bug update
 * Calls Firebase Cloud Function to generate email content
 */
export async function generateBugEmail(
  projectId: ProjectId,
  bugId: string,
  token?: string | null
): Promise<{ subject: string; body: string }> {
  await requireAuth(token);
  
  // Get the bug
  const bug = await getDocumentData<Bug>(projectId, 'bugs', bugId);
  if (!bug) {
    throw new Error(`Bug ${bugId} not found`);
  }
  
  // Normalize status to match expected format
  const status = bug.status || 'reported';
  const normalizedStatus = status.toLowerCase().replace('_', ' ');
  
  const requestBody = {
    issueDetails: {
      subject: bug.title || 'Bug Report',
      description: bug.description || '',
      status: normalizedStatus,
      bugType: bug.platform || 'General',
      name: bug.createdBy?.split('@')[0] || 'User',
    },
  };
  
  // Call Firebase Cloud Function
  const apiUrl = `https://us-central1-prepcenter-750c1.cloudfunctions.net/generateIssueEmail`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
  
  // Check if response is ok and is JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
  }
  
  const result = await response.json();
  
  if (response.ok && result.success) {
    return {
      subject: result.subject || `Update: ${bug.title || 'Bug Report'}`,
      body: result.body || '',
    };
  } else {
    const errorMsg = result.details || result.error || 'Failed to generate email';
    throw new Error(errorMsg);
  }
}

/**
 * Send an email update to the bug reporter or assigned user
 * Calls Firebase Cloud Function to send email and updates bug with email metadata
 * @param assignedToEmail If provided, sends to assigned user instead of reporter
 */
export async function sendBugUpdateEmail(
  projectId: ProjectId,
  bugId: string,
  subject: string,
  body: string,
  token?: string | null,
  assignedToEmail?: string | null
): Promise<void> {
  await requireAuth(token);
  
  // Get the bug
  const bug = await getDocumentData<Bug>(projectId, 'bugs', bugId);
  if (!bug) {
    throw new Error(`Bug ${bugId} not found`);
  }
  
  // Determine recipient email
  let recipientEmail: string | null = null;
  
  // If assignedToEmail is provided, use that (for assignment notifications)
  if (assignedToEmail) {
    recipientEmail = assignedToEmail;
  } else {
    // Otherwise, get reporter email from bug or from original report
    if (bug.createdBy && bug.createdBy.includes('@')) {
      recipientEmail = bug.createdBy;
    } else if (bug.convertedFromReportId) {
      // If converted from report, get email from report
      const collection = await getTopLevelCollection(projectId, 'feedbackAndBugs');
      const reportDoc = await collection.doc(bug.convertedFromReportId).get();
      if (reportDoc.exists) {
        const reportData = reportDoc.data();
        recipientEmail = reportData?.email || null;
      }
    }
  }
  
  if (!recipientEmail) {
    throw new Error('No recipient email found for this bug');
  }
  
  // Call Firebase Cloud Function to send email
  const functionUrl = `https://us-central1-prepcenter-750c1.cloudfunctions.net/sendIssueUpdateEmail`;
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: recipientEmail,
      subject: subject,
      body: body,
      issueId: bugId,
      issueSubject: bug.title || 'Bug Report',
    }),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Failed to send email');
  }
  
  // Update bug with email metadata (only if sending to reporter, not assignee)
  if (!assignedToEmail) {
    await updateDocument<Bug>(projectId, 'bugs', bugId, {
      lastEmailSent: new Date(),
      lastEmailSubject: subject,
    });
  }
}

/**
 * Parse email content and create/update an issue in feedbackAndBugs collection
 * Calls Firebase Cloud Function to parse email and create issue
 * 
 * NOTE: This function is specific to prepcenter projects only.
 * It creates/updates issues in the feedbackAndBugs collection (prepcenter structure).
 */
export async function parseEmailAndCreateIssue(
  projectId: ProjectId,
  emailContent: string,
  emailSubject: string,
  emailFrom: string,
  token?: string | null
): Promise<{ issueId: string; message: string }> {
  await requireAuth(token);
  
  // Only allow for prepcenter projects
  const project = getProject(projectId);
  if (project?.firebaseProjectType !== 'prepcenter') {
    throw new Error('parseEmailAndCreateIssue is only available for prepcenter projects');
  }
  
  const apiUrl = `https://us-central1-prepcenter-750c1.cloudfunctions.net/parseEmailAndCreateIssue`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      emailContent,
      emailSubject,
      emailFrom,
    }),
  });
  
  // Check if response is ok and is JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
  }
  
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error || 'Failed to parse email and create issue');
  }
  
  // If the email subject doesn't match, the function returns success but with a skip message
  // This is expected behavior, so we still return success
  return {
    issueId: result.issueId || '',
    message: result.message || 'Email processed',
  };
}
