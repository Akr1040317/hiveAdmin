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

/**
 * Parse service account JSON from environment variable string.
 * Handles Vercel's formatting where JSON may be wrapped in quotes and contains control characters.
 */
function parseServiceAccountJson(jsonString: string, projectType: FirebaseProjectType): any {
  let cleaned = jsonString.trim();
  const originalLength = cleaned.length;
  
  // Helper function to escape control characters within JSON string values
  // This properly handles unescaped newlines, tabs, etc. that break JSON parsing
  function escapeControlCharsInStrings(str: string): string {
    let result = '';
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const prevChar = i > 0 ? str[i - 1] : '';
      
      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        result += char;
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && prevChar !== '\\') {
        inString = !inString;
        result += char;
        continue;
      }
      
      if (inString) {
        // Inside a string value - escape control characters
        if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else if (char.charCodeAt(0) < 0x20) {
          // Other control characters
          result += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
        } else {
          result += char;
        }
      } else {
        // Outside string - keep as-is
        result += char;
      }
    }
    
    return result;
  }
  
  // Strategy 1: Try parsing as-is
  try {
    return JSON.parse(cleaned);
  } catch (error1) {
    const errorMsg = error1 instanceof Error ? error1.message : String(error1);
    
    // Strategy 2: Strip outer quotes (single or double)
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
      try {
        return JSON.parse(cleaned);
      } catch (error2) {
        // Strategy 3: Escape control characters in string values, then parse
        if (errorMsg.includes('control character') || errorMsg.includes('Bad control')) {
          try {
            const escaped = escapeControlCharsInStrings(cleaned);
            return JSON.parse(escaped);
          } catch (error3) {
            // Continue to next strategy
          }
        }
        
        // Strategy 4: Try unescaping the string first, then parse
        try {
          // Handle escaped quotes and newlines
          const unescaped = cleaned
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\n/g, '\n')
            .replace(/\\\\/g, '\\');
          return JSON.parse(unescaped);
        } catch (error4) {
          // Strategy 5: Try replacing \\n with \n then parse
          const withNewlines = cleaned.replace(/\\n/g, '\n');
          try {
            return JSON.parse(withNewlines);
          } catch (error5) {
            // Strategy 6: Escape control characters in the unescaped version
            try {
              const unescaped = cleaned
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\n/g, '\n')
                .replace(/\\\\/g, '\\');
              const escapedUnescaped = escapeControlCharsInStrings(unescaped);
              return JSON.parse(escapedUnescaped);
            } catch (error6) {
              // All strategies failed - log detailed error
              const sanitizedStart = cleaned.substring(0, 50).replace(/[^\x20-\x7E]/g, '?');
              const sanitizedEnd = cleaned.length > 50 ? cleaned.substring(cleaned.length - 50).replace(/[^\x20-\x7E]/g, '?') : '';
              console.error(`[${projectType}] Failed to parse JSON after all strategies`);
              console.error(`[${projectType}] Original length: ${originalLength}`);
              console.error(`[${projectType}] After quote stripping: ${cleaned.length}`);
              console.error(`[${projectType}] First 50 chars: ${sanitizedStart}`);
              console.error(`[${projectType}] Last 50 chars: ${sanitizedEnd}`);
              console.error(`[${projectType}] Parse error 1:`, errorMsg);
              console.error(`[${projectType}] Parse error 2:`, error2 instanceof Error ? error2.message : String(error2));
              throw error6; // Throw the last error
            }
          }
        }
      }
    } else {
      // No outer quotes, but parsing failed - try other strategies
      try {
        // Strategy 1: Escape control characters if error mentions them
        if (errorMsg.includes('control character') || errorMsg.includes('Bad control')) {
          const escaped = escapeControlCharsInStrings(cleaned);
          return JSON.parse(escaped);
        }
        // Strategy 2: Try replacing \\n with \n
        const withNewlines = cleaned.replace(/\\n/g, '\n');
        return JSON.parse(withNewlines);
      } catch (error8) {
        const sanitizedStart = cleaned.substring(0, 50).replace(/[^\x20-\x7E]/g, '?');
        console.error(`[${projectType}] Failed to parse JSON (no outer quotes)`);
        console.error(`[${projectType}] Length: ${originalLength}`);
        console.error(`[${projectType}] First 50 chars: ${sanitizedStart}`);
        console.error(`[${projectType}] Parse error:`, errorMsg);
        throw error8;
      }
    }
  }
}

function getServiceAccountConfig(projectType: FirebaseProjectType): ServiceAccountConfig | null {
  // ===== AGGRESSIVE DIAGNOSTIC LOGGING =====
  // Log at the very start to diagnose environment variable access issues
  console.log(`[${projectType}] ===== DIAGNOSTIC: getServiceAccountConfig called =====`);
  console.log(`[${projectType}] process.env is defined: ${typeof process.env !== 'undefined'}`);
  console.log(`[${projectType}] process.env type: ${typeof process.env}`);
  
  // Log first 20 environment variable keys
  const allEnvKeys = Object.keys(process.env || {});
  console.log(`[${projectType}] Total environment variables: ${allEnvKeys.length}`);
  console.log(`[${projectType}] First 20 env var keys: ${allEnvKeys.slice(0, 20).join(', ')}`);
  
  // Log ALL environment variables that contain "FIREBASE"
  const firebaseKeys = allEnvKeys.filter(k => k.includes('FIREBASE'));
  console.log(`[${projectType}] All FIREBASE_* env vars (${firebaseKeys.length}): ${firebaseKeys.join(', ')}`);
  
  // Priority 1: Check environment variable for JSON string (for Vercel/production)
  const envKey = `FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()}`;
  const serviceAccountJson = process.env[envKey];
  
  // Priority 2: Check environment variable for file path (for local development)
  const pathKey = `FIREBASE_SERVICE_ACCOUNT_PATH_${projectType.toUpperCase()}`;
  const serviceAccountPath = process.env[pathKey];
  
  // Log exact values (sanitized)
  console.log(`[${projectType}] Checking ${envKey}:`);
  console.log(`[${projectType}]   - Exists: ${serviceAccountJson !== undefined}`);
  console.log(`[${projectType}]   - Type: ${typeof serviceAccountJson}`);
  console.log(`[${projectType}]   - Length: ${serviceAccountJson?.length || 0}`);
  if (serviceAccountJson) {
    const sanitizedPreview = serviceAccountJson.substring(0, 100).replace(/private_key[^,}]*/gi, 'private_key":"***HIDDEN***');
    console.log(`[${projectType}]   - Preview (first 100 chars, sanitized): ${sanitizedPreview}...`);
  }
  
  console.log(`[${projectType}] Checking ${pathKey}:`);
  console.log(`[${projectType}]   - Exists: ${serviceAccountPath !== undefined}`);
  console.log(`[${projectType}]   - Value: ${serviceAccountPath || 'NOT SET'}`);
  console.log(`[${projectType}] ===== END DIAGNOSTIC =====`);
  
  // Enhanced logging for production debugging
  if (!serviceAccountJson && !serviceAccountPath) {
    console.error(`[${projectType}] Environment variable ${envKey} is not set`);
    console.error(`[${projectType}] Environment variable ${pathKey} is not set`);
    // Log all FIREBASE_SERVICE_ACCOUNT_* env vars for debugging
    const allFirebaseVars = Object.keys(process.env).filter(k => k.startsWith('FIREBASE_SERVICE_ACCOUNT_'));
    console.error(`[${projectType}] Available FIREBASE_SERVICE_ACCOUNT_* vars: ${allFirebaseVars.join(', ')}`);
  } else if (serviceAccountJson) {
    // Log sanitized info (hide private key)
    const sanitizedPreview = serviceAccountJson.substring(0, 100).replace(/private_key[^,}]*/gi, 'private_key":"***HIDDEN***');
    console.log(`[${projectType}] Found ${envKey}, length: ${serviceAccountJson.length}`);
    console.log(`[${projectType}] Preview (first 100 chars, sanitized): ${sanitizedPreview}...`);
  }
  
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
      // Use the robust parser that handles Vercel's formatting
      const parsed = parseServiceAccountJson(serviceAccountJson, projectType);
      
      // Validate required fields
      if (!parsed.private_key || !parsed.client_email || !parsed.project_id) {
        console.error(`[${projectType}] Service account JSON missing required fields`);
        console.error(`[${projectType}] Has private_key: ${!!parsed.private_key}`);
        console.error(`[${projectType}] Has client_email: ${!!parsed.client_email}`);
        console.error(`[${projectType}] Has project_id: ${!!parsed.project_id}`);
        return null;
      }
      
      // Handle private key - it should have \n as escape sequences
      let privateKey = parsed.private_key;
      if (typeof privateKey === 'string') {
        // Replace escaped newlines with actual newlines
        if (privateKey.includes('\\n') && !privateKey.includes('\n')) {
          privateKey = privateKey.replace(/\\n/g, '\n');
        }
        // Also handle double-escaped newlines (\\n -> \n)
        if (privateKey.includes('\\\\n')) {
          privateKey = privateKey.replace(/\\\\n/g, '\n');
        }
      }
      
      // Validate private key format
      if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        const keyPreview = privateKey.substring(0, 50).replace(/[^\x20-\x7E]/g, '?');
        console.error(`[${projectType}] Invalid private key format in JSON string`);
        console.error(`[${projectType}] Private key starts with: ${keyPreview}`);
        console.error(`[${projectType}] Private key length: ${privateKey.length}`);
        return null;
      }
      
      // Log success (always, not just in development, for production debugging)
      console.log(`[${projectType}] Successfully loaded service account from environment variable ${envKey}`);
      console.log(`[${projectType}] Project ID: ${parsed.project_id}`);
      console.log(`[${projectType}] Client Email: ${parsed.client_email}`);
      console.log(`[${projectType}] Private key length: ${privateKey.length} chars`);
      
      return {
        projectId: parsed.project_id,
        privateKey: privateKey,
        clientEmail: parsed.client_email,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${projectType}] Error parsing service account JSON from ${envKey}: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`[${projectType}] Stack trace:`, error.stack);
      }
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
