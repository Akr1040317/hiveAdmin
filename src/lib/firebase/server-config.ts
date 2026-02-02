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
  // Try to get from environment variables (JSON string or path)
  const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
  const pathKey = `FIREBASE_SERVICE_ACCOUNT_PATH_${projectType.toUpperCase()}`;
  
  const serviceAccountJson = process.env[envKey];
  const serviceAccountPath = process.env[pathKey];
  
  // Check if JSON string is a placeholder (contains "..." which indicates it's not real credentials)
  const isJsonPlaceholder = serviceAccountJson && (
    serviceAccountJson.includes('"private_key":"..."') ||
    serviceAccountJson.includes('"private_key": "..."') ||
    serviceAccountJson.includes('"private_key":"...') ||
    serviceAccountJson.includes('private_key":"...') ||
    serviceAccountJson.trim().length < 200 // Placeholder JSONs are usually short
  );
  
  if (process.env.NODE_ENV === 'development' && serviceAccountJson) {
    console.log(`[${projectType}] JSON string is placeholder: ${isJsonPlaceholder}`);
    console.log(`[${projectType}] JSON string length: ${serviceAccountJson.trim().length}`);
  }
  
  // For local development, prioritize file path over JSON string
  // Try file path first if it's set (for local development)
  if (serviceAccountPath) {
    try {
      // Resolve the path - handle both absolute and relative paths
      const resolvedPath = path.isAbsolute(serviceAccountPath) 
        ? serviceAccountPath 
        : path.resolve(process.cwd(), serviceAccountPath);
      
      // Check if file exists
      if (!fs.existsSync(resolvedPath)) {
        console.error(`[${projectType}] Service account file not found at: ${resolvedPath}`);
        console.error(`[${projectType}] Environment variable ${pathKey} = ${serviceAccountPath}`);
        console.error(`[${projectType}] Current working directory: ${process.cwd()}`);
        // Fall through to try JSON string if file doesn't exist
      } else {
        // Read and parse the file
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);
        
        // Validate required fields
        if (!serviceAccount.private_key || !serviceAccount.client_email || !serviceAccount.project_id) {
          console.error(`[${projectType}] Service account file missing required fields at: ${resolvedPath}`);
          // Fall through to try JSON string
        } else {
          // Success - return the config
          // The private_key in JSON already has \n as escape sequences, JSON.parse converts them to actual newlines
          let privateKey = serviceAccount.private_key;
          
          // If the private key has literal \n strings (shouldn't happen with proper JSON.parse, but just in case)
          if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
            privateKey = privateKey.replace(/\\n/g, '\n');
          }
          
          // Validate the private key starts correctly
          if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
            console.error(`[${projectType}] Invalid private key format - doesn't start with BEGIN marker`);
            console.error(`[${projectType}] First 50 chars: ${privateKey.substring(0, 50)}`);
            // Fall through to try JSON string
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[${projectType}] Successfully loaded service account from: ${resolvedPath}`);
              console.log(`[${projectType}] Private key length: ${privateKey.length}, starts with: ${privateKey.substring(0, 30)}`);
            }
            
            return {
              projectId: serviceAccount.project_id,
              privateKey: privateKey,
              clientEmail: serviceAccount.client_email,
            };
          }
        }
      }
    } catch (error: any) {
      console.error(`[${projectType}] Error loading service account from ${serviceAccountPath}:`, error.message);
      if (error.code === 'ENOENT') {
        console.error(`[${projectType}] File does not exist. Check your ${pathKey} environment variable.`);
      } else if (error instanceof SyntaxError) {
        console.error(`[${projectType}] Invalid JSON in service account file: ${serviceAccountPath}`);
      }
      // Fall through to try JSON string
    }
  }
  
  // Try JSON string (for Vercel/deployment, or if file path failed/not set)
  // Skip if it's a placeholder
  if (serviceAccountJson && !isJsonPlaceholder) {
    try {
      // If it's a JSON string, parse it
      const parsed = typeof serviceAccountJson === 'string' 
        ? JSON.parse(serviceAccountJson) 
        : serviceAccountJson;
      
      // Validate required fields
      if (!parsed.private_key || !parsed.client_email || !parsed.project_id) {
        console.error(`[${projectType}] Service account JSON missing required fields`);
        return null;
      }
      
      // The private_key in JSON string already has \n as escape sequences
      // When parsed from JSON string, they become actual newlines
      let privateKey = parsed.private_key;
      
      // If somehow we have literal \n strings, convert them
      if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      // Validate the private key format
      if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        console.error(`[${projectType}] Invalid private key format in JSON string`);
        return null;
      }
      
      return {
        projectId: parsed.project_id,
        privateKey: privateKey,
        clientEmail: parsed.client_email,
      };
    } catch (error) {
      console.error(`[${projectType}] Error parsing service account JSON:`, error);
      return null;
    }
  }
  
  // If JSON string is a placeholder, log a helpful message
  if (isJsonPlaceholder && serviceAccountPath) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${projectType}] JSON string appears to be a placeholder, using file path instead`);
    }
  } else if (isJsonPlaceholder && !serviceAccountPath) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[${projectType}] JSON string is a placeholder. Set ${pathKey} in .env.local to use file path`);
    }
  }
  
  // No credentials found
  if (process.env.NODE_ENV === 'development') {
    if (!serviceAccountPath && !serviceAccountJson) {
      console.warn(`[${projectType}] No service account credentials found.`);
      console.warn(`[${projectType}] Set ${envKey} (JSON string) or ${pathKey} (file path) in .env.local`);
    } else if (serviceAccountPath) {
      const resolvedPath = path.isAbsolute(serviceAccountPath) 
        ? serviceAccountPath 
        : path.resolve(process.cwd(), serviceAccountPath);
      if (!fs.existsSync(resolvedPath)) {
        console.warn(`[${projectType}] Service account file path set but file not found: ${resolvedPath}`);
      }
    }
  }
  
  return null;
}

function getFirebaseProjectId(projectType: FirebaseProjectType): string {
  const envKey = `${projectType.toUpperCase()}_FIREBASE_PROJECT_ID`;
  return process.env[envKey] || '';
}

export function getAdminApp(projectType: FirebaseProjectType): App {
  const cacheKey = projectType;
  const appName = `admin-${projectType}`;
  
  // First check if Firebase app already exists (Firebase Admin SDK's own registry)
  try {
    const existingApp = getApp(appName);
    if (existingApp) {
      // Cache it for future use
      if (!appCache.has(cacheKey)) {
        appCache.set(cacheKey, existingApp);
      }
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${projectType}] Using existing Firebase Admin app: ${appName}`);
      }
      return existingApp;
    }
  } catch (error) {
    // App doesn't exist yet, continue to create it
  }
  
  // Check our module-level cache
  if (appCache.has(cacheKey)) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${projectType}] Using cached Firebase Admin app`);
    }
    return appCache.get(cacheKey)!;
  }
  
  // Get service account config
  const serviceAccount = getServiceAccountConfig(projectType);
  const projectId = getFirebaseProjectId(projectType);
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
    const pathKey = `FIREBASE_SERVICE_ACCOUNT_PATH_${projectType.toUpperCase()}`;
    console.log(`[${projectType}] Checking service account config...`);
    console.log(`[${projectType}] ${envKey}: ${process.env[envKey] ? 'SET' : 'NOT SET'}`);
    console.log(`[${projectType}] ${pathKey}: ${process.env[pathKey] || 'NOT SET'}`);
    console.log(`[${projectType}] Service account loaded: ${serviceAccount ? 'YES' : 'NO'}`);
  }
  
  // Initialize app
  let app: App;
  
  if (!serviceAccount && projectType !== 'admin') {
    // Try to use admin service account as fallback if available
    // This works if both projects use the same Firebase project
    const adminServiceAccount = getServiceAccountConfig('admin');
    if (adminServiceAccount) {
      console.warn(
        `[${projectType}] Service account credentials not found, attempting to use admin service account as fallback. ` +
        `For better isolation, set FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()} in Vercel environment variables.`
      );
      // Use the admin service account's project ID (they must be the same project for this to work)
      const fallbackProjectId = adminServiceAccount.projectId;
      try {
        // Check if app already exists before initializing
        try {
          app = getApp(appName);
          if (process.env.NODE_ENV === 'development') {
            console.log(`[${projectType}] Firebase Admin app already exists, reusing: ${appName}`);
          }
        } catch (error) {
          // App doesn't exist, create it with admin credentials
          // Note: This only works if prepcenter and admin use the same Firebase project
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
        console.error(`[${projectType}] Please set FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()} with the correct service account JSON.`);
        // Fall through to throw the original error
      }
    }
    
    // In production, if credentials aren't set, log warning but don't throw
    // This allows the app to work in limited mode
    if (process.env.NODE_ENV === 'production') {
      const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
      console.error(
        `[${projectType}] Service account credentials not found. ` +
        `Set ${envKey} in Vercel environment variables (Settings > Environment Variables). ` +
        `If using the same Firebase project as admin, the admin service account will be used as fallback.`
      );
      throw new Error(
        `Service account credentials not found for ${projectType}. ` +
        `Set ${envKey} in Vercel environment variables. ` +
        `If ${projectType} uses the same Firebase project as admin, ensure FIREBASE_SERVICE_ACCOUNT_ADMIN is set.`
      );
    }
    throw new Error(
      `Service account credentials not found for ${projectType}. ` +
      `Set FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()} or ` +
      `FIREBASE_SERVICE_ACCOUNT_PATH_${projectType.toUpperCase()} environment variable.`
    );
  }
  
  if (projectType === 'admin') {
    // Admin project - use service account if available
    // For token verification, Firebase Admin SDK requires credentials
    if (serviceAccount) {
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
      // Try to use Application Default Credentials (for environments like GCP, Vercel, etc.)
      const adminProjectId = projectId || process.env.ADMIN_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (!adminProjectId) {
        throw new Error('Admin Firebase project ID not found. Set ADMIN_FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID');
      }
      
      try {
        // Check if app already exists before initializing
        try {
          app = getApp(appName);
          if (process.env.NODE_ENV === 'development') {
            console.log(`[${projectType}] Firebase Admin app already exists, reusing: ${appName}`);
          }
        } catch (error) {
          // App doesn't exist, create it
          // Try to initialize without explicit credentials (uses ADC if available)
          app = initializeApp({
            projectId: adminProjectId,
          }, appName);
        }
      } catch (error: any) {
        // If that fails, we need service account credentials
        const pathKey = `FIREBASE_SERVICE_ACCOUNT_PATH_ADMIN`;
        const jsonKey = `FIREBASE_SERVICE_ACCOUNT_ADMIN`;
        console.error(`[${projectType}] Failed to initialize admin Firebase Admin SDK:`, error.message);
        console.error(`[${projectType}] Service account not found. Check your environment variables.`);
        // In production, provide Vercel-specific instructions
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
          throw new Error(
            `Admin Firebase service account required for server-side token verification.\n` +
            `Please set ${jsonKey} in Vercel environment variables (Settings > Environment Variables).\n` +
            `See SETUP_ADMIN_SERVICE_ACCOUNT.md for instructions.\n` +
            `Original error: ${error.message}`
          );
        }
        throw new Error(
          `Admin Firebase service account required for server-side token verification.\n` +
          `Please set ${pathKey} or ${jsonKey} in your .env.local file.\n` +
          `See SETUP_ADMIN_SERVICE_ACCOUNT.md for instructions.\n` +
          `Original error: ${error.message}`
        );
      }
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
  const app = getAdminApp(projectType);
  return getFirestore(app);
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
      throw new Error(
        `Firebase Admin SDK initialization failed: ${error.message}. ` +
        `Set FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()} in Vercel environment variables.`
      );
    }
    throw error;
  }
}
