# Firebase Setup Reference

## Admin Firebase Project (Hive Admin)

**Project ID:** `hiveadmin-fb9e0`

**Configuration:**
- API Key: `AIzaSyASpqrZfrP9PlY5iR0aW5Rc8VSyuEXEWqE`
- Auth Domain: `hiveadmin-fb9e0.firebaseapp.com`
- Project ID: `hiveadmin-fb9e0`
- Storage Bucket: `hiveadmin-fb9e0.firebasestorage.app`
- Messaging Sender ID: `210842197707`
- App ID: `1:210842197707:web:d1db1a48698d6163e2854e`

**Purpose:** Authentication and admin configuration only

**Firestore Collections:**
- `/config/allowlist` - Email allowlist for access control

## PrepCenter Firebase Project

**Project ID:** `prepcenter-750c1`

**Service Account File:** `prepcenter-750c1-firebase-adminsdk-fbsvc-7e15094e23.json`

**Purpose:** Stores PrepCenter Oman and PrepCenter UAE data

**Firestore Collections:**
- `/projects/prepcenter-oman/` - PrepCenter Oman data
- `/projects/prepcenter-uae/` - PrepCenter UAE data

## Hive Firebase Project

**Project ID:** `beeapp-5c98b`

**Service Account File:** `beeapp-5c98b-firebase-adminsdk-g6vl0-0c34f5c176.json`

**Purpose:** Stores Hive Learner data

**Firestore Collections:**
- `/projects/hive-learner/` - Hive Learner data

## Setup Steps

1. **Admin Project** - ✅ Already configured in `.env.example`
2. **PrepCenter Project** - ✅ Project ID configured, add service account file path
3. **Hive Project** - ✅ Project ID configured, add service account file path

## Service Account Setup

### Local Development (Option 1 - Recommended)

1. Create a `service-accounts/` directory in the project root (this is gitignored)
2. Place the service account JSON files in that directory:
   - `prepcenter-750c1-firebase-adminsdk-fbsvc-7e15094e23.json`
   - `beeapp-5c98b-firebase-adminsdk-g6vl0-0c34f5c176.json`
3. In `.env.local`, set the file paths:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH_PREPCENTER=./service-accounts/prepcenter-750c1-firebase-adminsdk-fbsvc-7e15094e23.json
   FIREBASE_SERVICE_ACCOUNT_PATH_HIVE=./service-accounts/beeapp-5c98b-firebase-adminsdk-g6vl0-0c34f5c176.json
   ```

### Production/Vercel (Option 2)

1. Open each service account JSON file
2. Copy the entire JSON content
3. In Vercel environment variables, paste as a single-line string:
   - `FIREBASE_SERVICE_ACCOUNT_PREPCENTER` = `{"type":"service_account","project_id":"prepcenter-750c1",...}`
   - `FIREBASE_SERVICE_ACCOUNT_HIVE` = `{"type":"service_account","project_id":"beeapp-5c98b",...}`

**Important:** Service account files are in `.gitignore` - they will NEVER be committed to the repository.
