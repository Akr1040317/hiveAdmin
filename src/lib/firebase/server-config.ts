import { initializeApp, cert, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { FirebaseProjectType } from '@/lib/projects';
import fs from 'fs';
import path from 'path';

// Cache for initialized apps
const appCache: Map<string, App> = new Map();

interface ServiceAccountConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

function getServiceAccountConfig(projectType: FirebaseProjectType): ServiceAccountConfig | null {
  // Priority 1: Check environment variable for JSON string (for Vercel/production)
  const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
  const serviceAccountJson = process.env[envKey];
  
  // Priority 2: Check environment variable for file path (for local development)
  const pathKey = `FIREBASE_SERVICE_ACCOUNT_PATH_${projectType.toUpperCase()}`;
  const serviceAccountPath = process.env[pathKey];
  
  // Check if JSON string is a placeholder
  const isJsonPlaceholder = serviceAccountJson && (
    serviceAccountJson.includes('"private_key":"..."') ||
    serviceAccountJson.includes('"private_key": "..."') ||
    serviceAccountJson.includes('"private_key":"...') ||
    serviceAccountJson.includes('private_key":"...') ||
    serviceAccountJson.trim().length < 200
  );
  
  // Try JSON string first (for Vercel/production) - skip if placeholder
  if (serviceAccountJson && !isJsonPlaceholder) {
    try {
      const parsed = typeof serviceAccountJson === 'string' 
        ? JSON.parse(serviceAccountJson) 
        : serviceAccountJson;
      
      // Validate required fields
      if (!parsed.private_key || !parsed.client_email || !parsed.project_id) {
        console.error(`[${projectType}] Service account JSON missing required fields`);
        return null;
      }
      
      // Handle private key - it should have \n as escape sequences
      let privateKey = parsed.private_key;
      if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      // Validate private key format
      if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        console.error(`[${projectType}] Invalid private key format in JSON string`);
        return null;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${projectType}] Successfully loaded service account from environment variable ${envKey}`);
        console.log(`[${projectType}] Project ID: ${parsed.project_id}`);
      }
      
      return {
        projectId: parsed.project_id,
        privateKey: privateKey,
        clientEmail: parsed.client_email,
      };
    } catch (error) {
      console.error(`[${projectType}] Error parsing service account JSON from ${envKey}:`, error);
      // Fall through to try file path
    }
  }
  
  // Try file path (for local development)
  if (serviceAccountPath) {
    try {
      const resolvedPath = path.isAbsolute(serviceAccountPath) 
        ? serviceAccountPath 
        : path.resolve(process.cwd(), serviceAccountPath);
      
      if (!fs.existsSync(resolvedPath)) {
        console.error(`[${projectType}] Service account file not found at: ${resolvedPath}`);
        return null;
      }
      
      const fileContent = fs.readFileSync(resolvedPath, 'utf8');
      const serviceAccount = JSON.parse(fileContent);
      
      if (!serviceAccount.private_key || !serviceAccount.client_email || !serviceAccount.project_id) {
        console.error(`[${projectType}] Service account file missing required fields at: ${resolvedPath}`);
        return null;
      }
      
      let privateKey = serviceAccount.private_key;
      if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        console.error(`[${projectType}] Invalid private key format in file`);
        return null;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${projectType}] Successfully loaded service account from file: ${resolvedPath}`);
        console.log(`[${projectType}] Project ID: ${serviceAccount.project_id}`);
      }
      
      return {
        projectId: serviceAccount.project_id,
        privateKey: privateKey,
        clientEmail: serviceAccount.client_email,
      };
    } catch (error: any) {
      console.error(`[${projectType}] Error loading service account from file:`, error.message);
      return null;
    }
  }
  
  // No credentials found
  console.error(`[${projectType}] Service account credentials not found.`);
  console.error(`[${projectType}] Set ${envKey} (JSON string) for Vercel/production`);
  console.error(`[${projectType}] Or set ${pathKey} (file path) for local development`);
  
  return null;
}

function getFirebaseProjectId(projectType: FirebaseProjectType): string {
  const envKey = `${projectType.toUpperCase()}_FIREBASE_PROJECT_ID`;
  return process.env[envKey] || '';
}

export function getAdminApp(projectType: FirebaseProjectType): App {
  const cacheKey = projectType;
  const appName = `admin-${projectType}`;
  
  // Get service account config FIRST - we need to verify credentials before using cached apps
  const serviceAccount = getServiceAccountConfig(projectType);
  const projectId = getFirebaseProjectId(projectType);
  
  // For admin, service account is REQUIRED - check before using any cached app
  if (projectType === 'admin' && !serviceAccount) {
    const envKey = `FIREBASE_SERVICE_ACCOUNT_ADMIN`;
    const pathKey = `FIREBASE_SERVICE_ACCOUNT_PATH_ADMIN`;
    console.error(`[${projectType}] Admin Firebase service account required but not found.`);
    console.error(`[${projectType}] Set ${envKey} (JSON string) in Vercel environment variables for production`);
    console.error(`[${projectType}] Or set ${pathKey} (file path) in .env.local for local development`);
    throw new Error(
      `Admin Firebase service account required. ` +
      `Set ${envKey} in Vercel environment variables with valid service account JSON. ` +
      `See SETUP_ADMIN_SERVICE_ACCOUNT.md for instructions.`
    );
  }
  
  // First check if Firebase app already exists (Firebase Admin SDK's own registry)
  // Only use it if we have valid credentials
  try {
    const existingApp = getApp(appName);
    if (existingApp) {
      // Only cache and return if we have valid credentials (for admin) or if it's non-admin
      if (projectType === 'admin' && serviceAccount) {
        // Cache it for future use
        if (!appCache.has(cacheKey)) {
          appCache.set(cacheKey, existingApp);
        }
        if (process.env.NODE_ENV === 'development') {
          console.log(`[${projectType}] Using existing Firebase Admin app: ${appName}`);
        }
        return existingApp;
      } else if (projectType !== 'admin') {
        // For non-admin, we can use existing app (fallback logic handles credentials)
        if (!appCache.has(cacheKey)) {
          appCache.set(cacheKey, existingApp);
        }
        if (process.env.NODE_ENV === 'development') {
          console.log(`[${projectType}] Using existing Firebase Admin app: ${appName}`);
        }
        return existingApp;
      }
      // If admin and no credentials, don't use cached app - will throw error below
    }
  } catch (error) {
    // App doesn't exist yet, continue to create it
  }
  
  // Check our module-level cache (only if we have valid credentials for admin)
  if (appCache.has(cacheKey)) {
    if (projectType === 'admin' && !serviceAccount) {
      // Don't use cached app if admin has no credentials
      appCache.delete(cacheKey);
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${projectType}] Using cached Firebase Admin app`);
      }
      return appCache.get(cacheKey)!;
    }
  }
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
    const pathKey = `FIREBASE_SERVICE_ACCOUNT_PATH_${projectType.toUpperCase()}`;
    console.log(`[${projectType}] Checking service account config...`);
    console.log(`[${projectType}] ${envKey}: ${process.env[envKey] ? 'SET' : 'NOT SET'}`);
    console.log(`[${projectType}] ${pathKey}: ${process.env[pathKey] ? 'SET' : 'NOT SET'}`);
    console.log(`[${projectType}] Service account loaded: ${serviceAccount ? 'YES' : 'NO'}`);
    if (serviceAccount) {
      console.log(`[${projectType}] Project ID: ${serviceAccount.projectId}`);
      console.log(`[${projectType}] Client Email: ${serviceAccount.clientEmail}`);
    }
  }
  
  // Initialize app
  let app: App;
  
  if (!serviceAccount && projectType !== 'admin') {
    // Try to use admin service account as fallback if available
    // This works if both projects use the same Firebase project
    const adminServiceAccount = getServiceAccountConfig('admin');
    if (adminServiceAccount) {
      // Check if the project IDs match (they must be the same project for this to work)
      const requestedProjectId = projectId || '';
      const adminProjectId = adminServiceAccount.projectId;
      
      // If project IDs match or if no specific project ID was requested, try the fallback
      if (!requestedProjectId || requestedProjectId === adminProjectId) {
        const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
        console.warn(
          `[${projectType}] Service account credentials not found, attempting to use admin service account as fallback. ` +
          `For better isolation, set ${envKey} in Vercel environment variables.`
        );
        // Use the admin service account's project ID
        const fallbackProjectId = adminProjectId;
        try {
          // Check if app already exists before initializing
          try {
            app = getApp(appName);
            if (process.env.NODE_ENV === 'development') {
              console.log(`[${projectType}] Firebase Admin app already exists, reusing: ${appName}`);
            }
          } catch (error) {
            // App doesn't exist, create it with admin credentials
            console.log(`[${projectType}] Initializing Firebase Admin app with admin service account fallback (project: ${fallbackProjectId})`);
            app = initializeApp({
              credential: cert({
                projectId: fallbackProjectId,
                privateKey: adminServiceAccount.privateKey,
                clientEmail: adminServiceAccount.clientEmail,
              }),
              projectId: fallbackProjectId,
            }, appName);
          }
          appCache.set(cacheKey, app);
          console.log(`[${projectType}] Successfully initialized Firebase Admin app using admin service account fallback`);
          return app;
        } catch (fallbackError: any) {
          console.error(`[${projectType}] Failed to use admin service account as fallback:`, fallbackError.message);
          console.error(`[${projectType}] This usually means ${projectType} uses a different Firebase project than admin.`);
          const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
          console.error(`[${projectType}] Please set ${envKey} in Vercel environment variables with the correct service account JSON.`);
          // Fall through to throw the original error
        }
      } else {
        const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
        console.warn(
          `[${projectType}] Cannot use admin service account fallback: project IDs don't match. ` +
          `Requested: ${requestedProjectId}, Admin: ${adminProjectId}. ` +
          `Please set ${envKey} in Vercel environment variables with the correct service account JSON.`
        );
      }
    }
    
    // Service account not found
    const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
    const pathKey = `FIREBASE_SERVICE_ACCOUNT_PATH_${projectType.toUpperCase()}`;
    console.error(`[${projectType}] Service account credentials not found.`);
    console.error(`[${projectType}] Set ${envKey} (JSON string) in Vercel environment variables for production`);
    console.error(`[${projectType}] Or set ${pathKey} (file path) in .env.local for local development`);
    throw new Error(
      `Service account credentials not found for ${projectType}. ` +
      `Set ${envKey} in Vercel environment variables. ` +
      `If ${projectType} uses the same Firebase project as admin, ensure FIREBASE_SERVICE_ACCOUNT_ADMIN is set.`
    );
  }
  
  if (projectType === 'admin') {
    // Admin project - service account is REQUIRED, no ADC fallback
    // For token verification, Firebase Admin SDK requires credentials
    if (!serviceAccount) {
      // This should have been caught earlier, but double-check
      const envKey = `FIREBASE_SERVICE_ACCOUNT_ADMIN`;
      throw new Error(
        `Admin Firebase service account required. ` +
        `Set ${envKey} in Vercel environment variables with valid service account JSON. ` +
        `See SETUP_ADMIN_SERVICE_ACCOUNT.md for instructions.`
      );
    }
    
    try {
      // Validate private key before using it
      const privateKeyTrimmed = serviceAccount.privateKey.trim();
      if (!privateKeyTrimmed.startsWith('-----BEGIN PRIVATE KEY-----')) {
        throw new Error(`Invalid private key format - doesn't start with BEGIN marker. First 50 chars: ${privateKeyTrimmed.substring(0, 50)}`);
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${projectType}] Initializing Firebase Admin with service account...`);
        console.log(`[${projectType}] Project ID: ${serviceAccount.projectId}`);
        console.log(`[${projectType}] Client Email: ${serviceAccount.clientEmail}`);
        console.log(`[${projectType}] Private key length: ${privateKeyTrimmed.length}`);
      }
      
      // Check if app already exists before initializing
      try {
        app = getApp(appName);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[${projectType}] Firebase Admin app already exists, reusing: ${appName}`);
        }
      } catch (error) {
        // App doesn't exist, create it
        app = initializeApp({
          credential: cert({
            projectId: serviceAccount.projectId,
            privateKey: privateKeyTrimmed,
            clientEmail: serviceAccount.clientEmail,
          }),
          projectId: serviceAccount.projectId,
        }, appName);
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${projectType}] Firebase Admin app initialized successfully`);
      }
    } catch (initError: any) {
      console.error(`[${projectType}] Failed to initialize Firebase Admin app:`, initError.message);
      console.error(`[${projectType}] Error details:`, initError);
      throw initError;
    }
  } else {
    // Other projects use service account
    // Check if app already exists before initializing
    try {
      app = getApp(appName);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${projectType}] Firebase Admin app already exists, reusing: ${appName}`);
      }
    } catch (error) {
      // App doesn't exist, create it
      app = initializeApp({
        credential: cert({
          projectId: serviceAccount!.projectId,
          privateKey: serviceAccount!.privateKey,
          clientEmail: serviceAccount!.clientEmail,
        }),
        projectId: serviceAccount!.projectId,
      }, appName);
    }
  }
  
  // Cache the app
  appCache.set(cacheKey, app);
  
  return app;
}

export function getAdminFirestore(projectType: FirebaseProjectType): Firestore {
  try {
    const app = getAdminApp(projectType);
    return getFirestore(app);
  } catch (error: any) {
    console.error(`[getAdminFirestore] Error getting Firestore for ${projectType}:`, error.message);
    console.error(`[getAdminFirestore] Stack:`, error.stack);
    throw new Error(`Failed to get Firestore for ${projectType}: ${error.message}`);
  }
}

export function getAdminAuth(projectType: FirebaseProjectType = 'admin'): Auth {
  try {
    const app = getAdminApp(projectType);
    return getAuth(app);
  } catch (error: any) {
      // If initialization fails, throw a more descriptive error
      if (error.message?.includes('service account') || 
          error.message?.includes('Service account') ||
          error.message?.includes('credential') ||
          error.message?.includes('initialize')) {
        const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
        throw new Error(
          `Firebase Admin SDK initialization failed: ${error.message}. ` +
          `Set ${envKey} in Vercel environment variables with valid service account JSON.`
        );
      }
    throw error;
  }
}
