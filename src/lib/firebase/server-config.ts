import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { FirebaseProjectType } from '@/lib/projects';

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
  
  if (serviceAccountJson) {
    try {
      // If it's a JSON string, parse it
      const parsed = typeof serviceAccountJson === 'string' 
        ? JSON.parse(serviceAccountJson) 
        : serviceAccountJson;
      
      return {
        projectId: parsed.project_id,
        privateKey: parsed.private_key?.replace(/\\n/g, '\n'),
        clientEmail: parsed.client_email,
      };
    } catch (error) {
      console.error(`Error parsing service account for ${projectType}:`, error);
      return null;
    }
  }
  
  if (serviceAccountPath) {
    // If it's a file path, require it (for local development)
    try {
      const serviceAccount = require(serviceAccountPath);
      return {
        projectId: serviceAccount.project_id,
        privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n'),
        clientEmail: serviceAccount.client_email,
      };
    } catch (error) {
      console.error(`Error loading service account from ${serviceAccountPath}:`, error);
      return null;
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
  
  // Return cached app if exists
  if (appCache.has(cacheKey)) {
    return appCache.get(cacheKey)!;
  }
  
  // Get service account config
  const serviceAccount = getServiceAccountConfig(projectType);
  const projectId = getFirebaseProjectId(projectType);
  
  if (!serviceAccount && projectType !== 'admin') {
    throw new Error(
      `Service account credentials not found for ${projectType}. ` +
      `Set FIREBASE_SERVICE_ACCOUNT_${projectType.toUpperCase()} or ` +
      `FIREBASE_SERVICE_ACCOUNT_PATH_${projectType.toUpperCase()} environment variable.`
    );
  }
  
  // Initialize app
  let app: App;
  
  if (projectType === 'admin') {
    // Admin project - use service account if available
    // For token verification, Firebase Admin SDK requires credentials
    if (serviceAccount) {
      app = initializeApp({
        credential: cert({
          projectId: serviceAccount.projectId,
          privateKey: serviceAccount.privateKey,
          clientEmail: serviceAccount.clientEmail,
        }),
        projectId: serviceAccount.projectId,
      }, `admin-${projectType}`);
    } else {
      // Try to use Application Default Credentials (for environments like GCP, Vercel, etc.)
      const adminProjectId = projectId || process.env.ADMIN_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (!adminProjectId) {
        throw new Error('Admin Firebase project ID not found. Set ADMIN_FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID');
      }
      
      try {
        // Try to initialize without explicit credentials (uses ADC if available)
        app = initializeApp({
          projectId: adminProjectId,
        }, `admin-${projectType}`);
      } catch (error: any) {
        // If that fails, we need service account credentials
        console.error('Failed to initialize admin Firebase Admin SDK:', error.message);
        throw new Error(
          'Admin Firebase service account required for server-side token verification. ' +
          'Please generate a service account key for the admin Firebase project and set ' +
          'FIREBASE_SERVICE_ACCOUNT_PATH_ADMIN or FIREBASE_SERVICE_ACCOUNT_ADMIN environment variable.'
        );
      }
    }
  } else {
    // Other projects use service account
    app = initializeApp({
      credential: cert({
        projectId: serviceAccount!.projectId,
        privateKey: serviceAccount!.privateKey,
        clientEmail: serviceAccount!.clientEmail,
      }),
      projectId: serviceAccount!.projectId,
    }, `admin-${projectType}`);
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
  const app = getAdminApp(projectType);
  return getAuth(app);
}
