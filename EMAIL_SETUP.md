# Email Communication Setup

## Overview

The email communication system uses **Firebase Cloud Functions** hosted in the `prepcenter-750c1` Firebase project to send emails to bug reporters. The admin app calls these functions via HTTP requests.

## Architecture

```
Admin App (Next.js)
    ↓ (HTTP POST)
Firebase Cloud Functions (prepcenter-750c1)
    ↓ (Email Service API)
Email Provider (SendGrid/Mailgun/Gmail/etc.)
    ↓
Bug Reporter's Email
```

## Firebase Cloud Functions Used

### 1. `generateIssueEmail`
**URL:** `https://us-central1-prepcenter-750c1.cloudfunctions.net/generateIssueEmail`

**Purpose:** Generates AI-powered email content based on bug details

**Request Body:**
```json
{
  "issueDetails": {
    "subject": "Bug title",
    "description": "Bug description",
    "status": "in progress",
    "bugType": "web",
    "name": "Reporter name"
  }
}
```

**Response:**
```json
{
  "success": true,
  "subject": "Generated email subject",
  "body": "Generated email body"
}
```

**Location:** This function is hosted in the `prepcenter-750c1` Firebase project (us-central1 region)

### 2. `sendIssueUpdateEmail`
**URL:** `https://us-central1-prepcenter-750c1.cloudfunctions.net/sendIssueUpdateEmail`

**Purpose:** Sends an email to the bug reporter

**Request Body:**
```json
{
  "to": "reporter@example.com",
  "subject": "Email subject",
  "body": "Email message body",
  "issueId": "bug-id-123",
  "issueSubject": "Bug title"
}
```

**Response:**
```json
{
  "success": true
}
```

**Location:** This function is hosted in the `prepcenter-750c1` Firebase project (us-central1 region)

### 3. `parseEmailAndCreateIssue`
**URL:** `https://us-central1-prepcenter-750c1.cloudfunctions.net/parseEmailAndCreateIssue`

**Purpose:** Parses email content and creates/updates issues in the `feedbackAndBugs` collection

**Request Body:**
```json
{
  "emailContent": "Full email HTML/text content",
  "emailSubject": "Email subject line",
  "emailFrom": "sender@example.com"
}
```

**Response:**
```json
{
  "message": "Issue created successfully" | "Issue updated successfully" | "Email subject does not match 'New Bug Report', skipping",
  "issueId": "document-id"
}
```

**Behavior:**
- Only processes emails with subject containing "New Bug Report"
- Parses email content to extract bug report fields (name, email, description, steps to reproduce, etc.)
- Creates new issue in `feedbackAndBugs` collection if not exists
- Updates existing issue if Document ID matches
- Returns success even if email subject doesn't match (skips processing)

**Location:** This function is hosted in the `prepcenter-750c1` Firebase project (us-central1 region)

**Use Cases:**
- Gmail integration workflows
- Email parsing from external sources
- Manual email-to-issue conversion

## Sender Email Configuration

**Important:** The sender email address is **NOT configured in this codebase**. It is configured within the Firebase Cloud Functions themselves.

The Cloud Functions likely use one of these email services:
- **SendGrid** (most common for Firebase projects)
- **Mailgun**
- **Gmail API** (via OAuth2)
- **Firebase Extensions** (Email Trigger extension)

To find out what sender email is being used:
1. Check the Cloud Functions code in the `prepcenter-750c1` Firebase project
2. Look for environment variables or configuration in Firebase Console > Functions > Configuration
3. Check the email service provider dashboard (SendGrid/Mailgun/etc.)

## How It Works

### Step 1: Generate Email (Optional)
1. User clicks "Generate Email with AI" button in DetailDrawer
2. Admin app calls `generateBugEmail` server action
3. Server action makes HTTP POST to `generateIssueEmail` Cloud Function
4. Cloud Function uses AI (likely OpenAI/Gemini) to generate email content
5. Generated subject and body are returned and displayed in the email composer

### Step 2: Send Email
1. User fills in/composes email subject and body
2. User clicks "Send Email" button
3. Admin app calls `sendBugUpdateEmail` server action
4. Server action:
   - Gets reporter email from bug (`createdBy` field or from original report)
   - Makes HTTP POST to `sendIssueUpdateEmail` Cloud Function
   - Cloud Function sends email via email service provider
5. Server action updates bug with `lastEmailSent` and `lastEmailSubject` metadata

## Reporter Email Detection

The system finds the reporter email in this order:
1. **From bug's `createdBy` field** - If it contains an `@` symbol (is an email)
2. **From original report** - If bug was converted from a report (`convertedFromReportId`), fetch email from the `feedbackAndBugs` collection
3. **Error** - If no email found, throw error: "No reporter email found for this bug"

## Email Metadata Tracking

When an email is sent, the bug document is updated with:
- `lastEmailSent`: Timestamp of when email was sent
- `lastEmailSubject`: Subject line of the last email sent

This metadata is displayed in the DetailDrawer showing when the last email was sent.

## Code Locations

### Server Actions
- **File:** `src/app/actions/bugs.ts`
- **Functions:**
  - `generateBugEmail()` - Calls Cloud Function to generate email
  - `sendBugUpdateEmail()` - Calls Cloud Function to send email
  - `parseEmailAndCreateIssue()` - Calls Cloud Function to parse email and create/update issue

### UI Components
- **File:** `src/components/shared/DetailDrawer.tsx`
- **Features:**
  - Email composer section (toggleable)
  - "Generate Email with AI" button
  - "Send Email" button
  - Last email sent timestamp display

### Page Integration
- **File:** `src/app/admin/[projectId]/bugs/page.tsx`
- **Wires up:** Email handlers, reporter email detection, email metadata display

## Cloud Functions Setup

To set up or modify the Cloud Functions, you need access to the `prepcenter-750c1` Firebase project:

1. **Deploy Location:** Firebase Console > Functions (for prepcenter-750c1 project)
2. **Region:** us-central1
3. **Runtime:** Node.js (version depends on function code)
4. **Required Environment Variables:** (check function code)
   - Email service API keys (SendGrid/Mailgun/etc.)
   - AI service API keys (OpenAI/Gemini/etc.) for email generation

## Testing Email Functionality

### Prerequisites
1. Cloud Functions must be deployed and running
2. Email service must be configured in Cloud Functions
3. Bug must have a valid reporter email

### Test Flow
1. Open a bug in DetailDrawer
2. Click "Compose Email" button
3. Click "Generate Email with AI" (optional)
4. Review/edit email content
5. Click "Send Email"
6. Check bug's `lastEmailSent` field updates
7. Verify email received by reporter

## Troubleshooting

### "No reporter email found"
- Check if bug has `createdBy` with email format
- If converted from report, verify report has `email` field
- Check Firestore data structure

### "Failed to generate email"
- Check Cloud Function logs in Firebase Console
- Verify AI service API key is configured
- Check function is deployed and accessible

### "Failed to send email"
- Check Cloud Function logs in Firebase Console
- Verify email service API key is configured
- Check sender email is verified in email service
- Verify recipient email is valid

### "Failed to parse email and create issue"
- Check Cloud Function logs in Firebase Console
- Verify email subject contains "New Bug Report"
- Check email content format matches expected structure
- Verify function is deployed and accessible
- Note: Function returns success even if email subject doesn't match (skips processing)

### Email not received
- Check spam folder
- Verify sender email domain reputation
- Check email service provider logs
- Verify Cloud Function executed successfully

## Security Considerations

1. **Authentication:** Server actions require authentication (`requireAuth`)
2. **Rate Limiting:** Cloud Functions should implement rate limiting
3. **Email Validation:** Cloud Functions should validate email addresses
4. **Spam Prevention:** Email service should have spam prevention configured
5. **API Keys:** Never expose email service API keys in client code

## Future Improvements

- Add email templates
- Add email history/threading
- Add email scheduling
- Add email delivery status tracking
- Add support for multiple email providers
- Add email preview before sending
