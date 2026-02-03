#!/bin/bash

# Script to generate Vercel environment variable values from service account files
# This outputs the JSON strings ready to paste into Vercel's environment variables

echo "=========================================="
echo "Vercel Environment Variables Setup"
echo "=========================================="
echo ""
echo "Copy each JSON string below and paste it into Vercel:"
echo "Settings > Environment Variables > Add New"
echo ""
echo "=========================================="
echo ""

# Function to read and minify JSON
read_and_minify_json() {
  local file=$1
  if [ -f "$file" ]; then
    # Read file and remove all whitespace/newlines, output as single line
    cat "$file" | jq -c '.' 2>/dev/null || cat "$file" | tr -d '\n' | tr -d ' '
  else
    echo "FILE_NOT_FOUND"
  fi
}

# Admin service account
echo "1. FIREBASE_SERVICE_ACCOUNT_ADMIN"
echo "   (for Production, Preview, and Development)"
echo "   Value:"
ADMIN_JSON=$(read_and_minify_json "service-accounts/hiveadmin-fb9e0-firebase-adminsdk-fbsvc-8429a5d36f.json")
if [ "$ADMIN_JSON" != "FILE_NOT_FOUND" ]; then
  echo "$ADMIN_JSON"
else
  echo "   ERROR: File not found"
fi
echo ""
echo "---"
echo ""

# Prepcenter service account
echo "2. FIREBASE_SERVICE_ACCOUNT_PREPCENTER"
echo "   (for Production, Preview, and Development)"
echo "   Value:"
PREPCENTER_JSON=$(read_and_minify_json "service-accounts/prepcenter-750c1-firebase-adminsdk-fbsvc-7e15094e23.json")
if [ "$PREPCENTER_JSON" != "FILE_NOT_FOUND" ]; then
  echo "$PREPCENTER_JSON"
else
  echo "   ERROR: File not found"
fi
echo ""
echo "---"
echo ""

# Hive service account
echo "3. FIREBASE_SERVICE_ACCOUNT_HIVE"
echo "   (for Production, Preview, and Development)"
echo "   Value:"
HIVE_JSON=$(read_and_minify_json "service-accounts/beeapp-5c98b-firebase-adminsdk-g6vl0-0c34f5c176.json")
if [ "$HIVE_JSON" != "FILE_NOT_FOUND" ]; then
  echo "$HIVE_JSON"
else
  echo "   ERROR: File not found"
fi
echo ""
echo "=========================================="
echo ""
echo "Instructions:"
echo "1. Go to: https://vercel.com/dashboard"
echo "2. Select your project (hive-admin)"
echo "3. Go to Settings > Environment Variables"
echo "4. For each variable above:"
echo "   - Click 'Add New'"
echo "   - Name: FIREBASE_SERVICE_ACCOUNT_ADMIN (or PREPCENTER, HIVE)"
echo "   - Value: Paste the JSON string (single line)"
echo "   - Environment: Select all (Production, Preview, Development)"
echo "   - Click 'Save'"
echo "5. After setting all variables, trigger a new deployment"
echo ""
