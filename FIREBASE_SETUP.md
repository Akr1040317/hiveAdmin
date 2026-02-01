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

**Project ID:** (To be configured)

**Purpose:** Stores PrepCenter Oman and PrepCenter UAE data

**Firestore Collections:**
- `/projects/prepcenter-oman/` - PrepCenter Oman data
- `/projects/prepcenter-uae/` - PrepCenter UAE data

## Hive Firebase Project

**Project ID:** (To be configured)

**Purpose:** Stores Hive Learner data

**Firestore Collections:**
- `/projects/hive-learner/` - Hive Learner data

## Setup Steps

1. **Admin Project** - Already configured in `.env.example`
2. **PrepCenter Project** - Add project ID and service account credentials
3. **Hive Project** - Add project ID and service account credentials

## Service Account Setup

For PrepCenter and Hive projects:
1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Add to `.env.local` as `FIREBASE_SERVICE_ACCOUNT_PREPCENTER` and `FIREBASE_SERVICE_ACCOUNT_HIVE`
