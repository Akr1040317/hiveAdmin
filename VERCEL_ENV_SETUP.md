# Vercel Environment Variables Setup

## Current Issues

Based on the Vercel error logs, the following environment variables need to be set in Vercel:

### Required Environment Variables

1. **`FIREBASE_SERVICE_ACCOUNT_ADMIN`** (REQUIRED)
   - Error: "Could not load the default credentials"
   - This is causing 500 errors on goals, features, tasks, meetings, calendar pages
   - Must contain the full service account JSON (not a placeholder)

2. **`FIREBASE_SERVICE_ACCOUNT_PREPCENTER`** (REQUIRED)
   - Error: "Service account credentials not found for prepcenter"
   - This is causing 500 errors on bugs, views, and other prepcenter-specific collections
   - Must contain the full service account JSON (not a placeholder)

3. **`FIREBASE_SERVICE_ACCOUNT_HIVE`** (Optional, but recommended)
   - Needed if you use hive-learner project
   - Must contain the full service account JSON (not a placeholder)

## How to Set Environment Variables in Vercel

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project (`hiveAdmin` or `hiveadmincenter`)
3. Go to **Settings** > **Environment Variables**
4. For each variable above:
   - Click **Add New**
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_ADMIN` (or `PREPCENTER`, `HIVE`)
   - **Value**: Paste the **entire** service account JSON as a single-line string
   - **Environment**: Select all (Production, Preview, Development)
   - Click **Save**

## Getting Service Account JSON

### Option 1: From Local Files

You have the service account files in `service-accounts/` directory:

```bash
# Read the admin service account
cat service-accounts/hiveadmin-fb9e0-firebase-adminsdk-fbsvc-8429a5d36f.json

# Read the prepcenter service account  
cat service-accounts/prepcenter-750c1-firebase-adminsdk-fbsvc-7e15094e23.json

# Read the hive service account
cat service-accounts/beeapp-5c98b-firebase-adminsdk-g6vl0-0c34f5c176.json
```

Copy the entire JSON content and paste it as the value in Vercel (as a single line).

### Option 2: From Firebase Console

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select the project (hiveadmin-fb9e0, prepcenter-750c1, or beeapp-5c98b)
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Open the file and copy the entire JSON content
7. Paste it as a single-line string in Vercel

## Important Notes

- **DO NOT** use placeholder values like `"private_key":"..."` - these won't work
- The JSON must be valid and complete
- Paste it as a **single-line string** (no line breaks)
- Make sure all required fields are present: `type`, `project_id`, `private_key`, `client_email`
- After setting variables, **redeploy** your Vercel project for changes to take effect

## Verifying Setup

After setting the environment variables, you can verify by:

1. Checking Vercel deployment logs - you should see successful Firebase initialization
2. Testing the application - goals, bugs, and other pages should load without 500 errors
3. The error messages should change from "Could not load default credentials" to successful data loading

## Troubleshooting

If you still see errors after setting environment variables:

1. **Check the JSON format**: Make sure it's valid JSON (use a JSON validator)
2. **Check for line breaks**: Vercel environment variables should be single-line
3. **Redeploy**: After changing environment variables, trigger a new deployment
4. **Check logs**: Look at Vercel function logs for detailed error messages
5. **Verify project IDs**: Make sure the `project_id` in the JSON matches the Firebase project

## Current Status

Based on error logs:
- ❌ `FIREBASE_SERVICE_ACCOUNT_ADMIN` - Not set or invalid (causing goals/features/tasks/meetings/calendar errors)
- ❌ `FIREBASE_SERVICE_ACCOUNT_PREPCENTER` - Not set (causing bugs/views errors)
- ❓ `FIREBASE_SERVICE_ACCOUNT_HIVE` - Unknown status
