# Hive Admin

Private admin web app for managing multiple projects (Hive Learner, PrepCenter Oman, PrepCenter UAE).

## Tech Stack

- **Next.js 14+** with App Router and TypeScript
- **Tailwind CSS** for styling
- **Firebase** (Auth + Firestore) for backend - Multi-project architecture
- **Firebase Admin SDK** for server-side cross-project access
- **Vercel** for deployment

## Architecture

The app uses **three separate Firebase projects**:

1. **Admin Firebase Project**: Handles authentication and admin configuration
2. **PrepCenter Firebase Project**: Stores PrepCenter Oman and PrepCenter UAE data
3. **Hive Firebase Project**: Stores Hive Learner data

Authentication happens in the admin project, then the app accesses data from the appropriate Firebase project using service account credentials (server-side only).

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Projects Setup

You need to create/configure three Firebase projects:

#### Admin Firebase Project
1. Create a Firebase project for the admin app
2. Enable Authentication with Google Sign-in provider
3. Create a Firestore database
4. Copy your Firebase config values

#### PrepCenter Firebase Project
1. Use your existing PrepCenter Firebase project (or create a new one)
2. Create a Firestore database if it doesn't exist
3. Generate a service account key (Project Settings > Service Accounts > Generate New Private Key)

#### Hive Firebase Project
1. Use your existing Hive Firebase project (or create a new one)
2. Create a Firestore database if it doesn't exist
3. Generate a service account key (Project Settings > Service Accounts > Generate New Private Key)

### 3. Service Account Setup

For each Firebase project (Admin, PrepCenter, Hive):

1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. You'll use this in environment variables (see below)

### 4. Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Fill in your configuration:

```env
# Admin Firebase (for authentication)
NEXT_PUBLIC_FIREBASE_API_KEY=your_admin_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_admin_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_admin_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_admin_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_admin_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_admin_app_id

# Firebase Project IDs
ADMIN_FIREBASE_PROJECT_ID=your_admin_project_id
PREPCENTER_FIREBASE_PROJECT_ID=your_prepcenter_project_id
HIVE_FIREBASE_PROJECT_ID=your_hive_project_id

# Service Account Credentials (server-side only)
# Option 1: JSON string (recommended for Vercel/deployment)
# Paste the entire service account JSON as a single-line string
FIREBASE_SERVICE_ACCOUNT_ADMIN={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
FIREBASE_SERVICE_ACCOUNT_PREPCENTER={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
FIREBASE_SERVICE_ACCOUNT_HIVE={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}

# Option 2: File paths (for local development only)
# Place service account JSON files in a secure location (not committed to git)
# FIREBASE_SERVICE_ACCOUNT_PATH_ADMIN=./service-accounts/admin-service-account.json
# FIREBASE_SERVICE_ACCOUNT_PATH_PREPCENTER=./service-accounts/prepcenter-service-account.json
# FIREBASE_SERVICE_ACCOUNT_PATH_HIVE=./service-accounts/hive-service-account.json

# Optional: comma-separated allowlist (or use Firestore /config/allowlist in admin project)
ALLOWED_EMAILS=admin@example.com,another@example.com
```

**Important Security Notes:**
- Service account credentials are server-side only and never exposed to the client
- Never commit service account JSON files to git
- For Vercel deployment, use environment variables (JSON string format)

### 5. Firestore Setup

#### Security Rules

Deploy security rules to each Firebase project:

**Admin Firebase Project:**
```bash
# Use firestore.rules
firebase use admin-project-id
firebase deploy --only firestore:rules
```

**PrepCenter Firebase Project:**
```bash
# Use firestore.prepcenter.rules
firebase use prepcenter-project-id
firebase deploy --only firestore:rules --rules firestore.prepcenter.rules
```

**Hive Firebase Project:**
```bash
# Use firestore.hive.rules
firebase use hive-project-id
firebase deploy --only firestore:rules --rules firestore.hive.rules
```

Or manually copy the rules from each file to Firebase Console > Firestore > Rules for each project.

#### Initial Data Setup

Create a document at `/config/allowlist` in the **Admin Firebase Project** Firestore:

```json
{
  "emails": [
    "admin@example.com",
    "another@example.com"
  ]
}
```

**Note:** You can use either the Firestore allowlist OR the `ALLOWED_EMAILS` env var. Firestore takes precedence if both are set.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Login page
│   ├── admin/             # Admin routes
│   │   ├── page.tsx       # Project selector
│   │   └── [projectId]/   # Project-specific routes
│   └── actions/           # Server Actions for CRUD operations
│       ├── bugs.ts
│       ├── features.ts
│       ├── content.ts
│       ├── meetings.ts
│       ├── documents.ts
│       └── calendar.ts
├── components/
│   ├── ui/                # Reusable UI components
│   ├── layout/            # Layout components
│   └── auth/              # Auth components
├── contexts/              # React contexts
├── lib/
│   ├── firebase/          # Firebase config and helpers
│   │   ├── config.ts      # Client-side Firebase config (admin project)
│   │   ├── server-config.ts  # Server-side Firebase Admin SDK
│   │   ├── server-auth.ts # Server-side auth verification
│   │   ├── data-access.ts # Data access abstraction layer
│   │   └── auth.ts        # Auth helpers
│   └── projects.ts        # Project configuration
└── hooks/                 # Custom hooks
```

## Features

### Phase 0 & 1 (Completed)
- ✅ Dark theme design system with accent colors
- ✅ Firebase authentication with Google Sign-in
- ✅ Email allowlist access control
- ✅ Password reset flow
- ✅ Project selector dashboard
- ✅ Protected routes

### Phase 2 (Completed)
- ✅ Project context and routing
- ✅ Dynamic sidebar navigation
- ✅ Project accent color system
- ✅ Stub pages for all modules

### Phase 3+ (In Progress)
- ✅ Multi-Firebase project architecture
- ✅ Server Actions for all CRUD operations
- ✅ Service account-based cross-project data access
- ⏳ UI implementation for CRUD operations
- ⏳ Calendar month view
- ⏳ Meeting agenda and notes
- ⏳ Document management

## Projects

Each project has a unique accent color:

- **Hive Learner**: Purple
- **PrepCenter Oman**: Orange  
- **PrepCenter UAE**: Blue

The accent color is used throughout the UI to indicate the active project.

## Deployment

### Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

The app will automatically deploy on every push to main.

## Development Notes

### Data Storage

- **Admin Firebase**: Stores `/config/allowlist` only
- **PrepCenter Firebase**: Stores `/projects/prepcenter-oman/` and `/projects/prepcenter-uae/`
- **Hive Firebase**: Stores `/projects/hive-learner/`

### Data Access

- All data operations go through **Server Actions** (server-side only)
- Server Actions verify admin Firebase authentication
- Service account credentials are used to access PrepCenter and Hive Firebase projects
- Client-side components call Server Actions, never directly access Firestore

### Architecture

- Project separation is enforced at the route level and Firebase project level
- Accent colors are applied dynamically via ProjectContext
- Dark theme uses near-black backgrounds (#0a0a0a) with lighter cards (#1a1a1a)

### Security

- Service account credentials are server-side only (never exposed to client)
- All Firestore operations require authentication verification
- Each Firebase project has its own security rules
- Client-side access to PrepCenter/Hive Firestore is denied (server actions only)

### Using Server Actions from Client

All server actions require an authentication token. Here's how to use them:

```typescript
'use client';

import { getIdToken } from '@/lib/firebase/client-auth';
import { getBugs, createBug } from '@/app/actions/bugs';

async function loadBugs(projectId: ProjectId) {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const bugs = await getBugs(projectId, token);
  return bugs;
}

async function addBug(projectId: ProjectId, bugData: BugData) {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const bugId = await createBug(projectId, bugData, token);
  return bugId;
}
```

**Note:** All server actions accept an optional `token` parameter as the last argument. If not provided, the server will try to get it from the Authorization header (useful for API routes).
