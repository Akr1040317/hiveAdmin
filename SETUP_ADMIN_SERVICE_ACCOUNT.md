# Setting Up Admin Firebase Service Account

The admin Firebase project needs a service account for server-side token verification.

## Steps

1. Go to Firebase Console: https://console.firebase.google.com/project/hiveadmin-fb9e0/settings/serviceaccounts/adminsdk

2. Click "Generate New Private Key"

3. Download the JSON file (it will be named something like `hiveadmin-fb9e0-firebase-adminsdk-xxxxx-xxxxx.json`)

4. Place it in the `service-accounts/` directory

5. Update `.env.local`:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH_ADMIN=./service-accounts/hiveadmin-fb9e0-firebase-adminsdk-xxxxx-xxxxx.json
   ```

6. Restart the dev server

## Alternative: Use JSON String (for Vercel)

Instead of file path, you can paste the entire JSON content as a single-line string in `.env.local`:

```
FIREBASE_SERVICE_ACCOUNT_ADMIN={"type":"service_account","project_id":"hiveadmin-fb9e0",...}
```

**Note:** Make sure the JSON is on a single line with no line breaks.
