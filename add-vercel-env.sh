#!/bin/bash

# Add Firebase environment variables to Vercel
# This script adds all required NEXT_PUBLIC_* variables for production, preview, and development

echo "Adding Firebase environment variables to Vercel..."

# Function to add env var to all environments
add_env_var() {
    local var_name=$1
    local var_value=$2
    
    echo "Adding $var_name..."
    echo "$var_value" | vercel env add "$var_name" production --yes
    echo "$var_value" | vercel env add "$var_name" preview --yes
    echo "$var_value" | vercel env add "$var_name" development --yes
}

# Required Firebase Client Config
add_env_var "NEXT_PUBLIC_FIREBASE_API_KEY" "AIzaSyASpqrZfrP9PlY5iR0aW5Rc8VSyuEXEWqE"
add_env_var "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" "hiveadmin-fb9e0.firebaseapp.com"
add_env_var "NEXT_PUBLIC_FIREBASE_PROJECT_ID" "hiveadmin-fb9e0"
add_env_var "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" "hiveadmin-fb9e0.firebasestorage.app"
add_env_var "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" "210842197707"
add_env_var "NEXT_PUBLIC_FIREBASE_APP_ID" "1:210842197707:web:d1db1a48698d6163e2854e"

# Firebase Project IDs (server-side)
add_env_var "ADMIN_FIREBASE_PROJECT_ID" "hiveadmin-fb9e0"
add_env_var "PREPCENTER_FIREBASE_PROJECT_ID" "prepcenter-750c1"
add_env_var "HIVE_FIREBASE_PROJECT_ID" "beeapp-5c98b"

echo "Done! Environment variables added to Vercel."
echo "Note: Service account credentials need to be added manually if you have them."
