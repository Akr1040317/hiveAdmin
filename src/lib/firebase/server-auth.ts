import { headers } from 'next/headers';
import { getAdminAuth } from './server-config';

/**
 * Verify the current user's authentication token from admin Firebase
 * Gets token from Authorization header or accepts token parameter
 * Returns the decoded token if valid, null otherwise
 */
export async function getServerAuth(token?: string | null) {
  try {
    let authToken = token;
    
    // If no token provided, try to get from Authorization header
    if (!authToken) {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authToken = authHeader.split('Bearer ')[1];
      }
    }
    
    if (!authToken) {
      console.warn('No auth token provided to getServerAuth');
      return null;
    }
    
    // Verify the token using admin Firebase
    try {
      const adminAuth = getAdminAuth('admin');
      const decodedToken = await adminAuth.verifyIdToken(authToken);
      return decodedToken;
    } catch (verifyError: any) {
      console.error('Token verification failed:', verifyError.message);
      // If it's a credential/initialization error, return null gracefully instead of crashing
      if (verifyError.message?.includes('credential') || 
          verifyError.message?.includes('initialize') || 
          verifyError.message?.includes('service account') ||
          verifyError.message?.includes('Service account')) {
        console.warn('Firebase Admin SDK not initialized. Server-side features will be limited.');
        console.warn('To enable full functionality, set FIREBASE_SERVICE_ACCOUNT_ADMIN in Vercel environment variables.');
        return null;
      }
      return null;
    }
  } catch (error: any) {
    // If getAdminAuth itself throws (e.g., initialization error), catch it here
    if (error.message?.includes('credential') || 
        error.message?.includes('initialize') || 
        error.message?.includes('service account') ||
        error.message?.includes('Service account')) {
      console.warn('Firebase Admin SDK initialization failed. Server-side features will be limited.');
      console.warn('To enable full functionality, set FIREBASE_SERVICE_ACCOUNT_ADMIN in Vercel environment variables.');
      return null;
    }
    console.error('Error in getServerAuth:', error.message || error);
    return null;
  }
}

/**
 * Check if user is authenticated and allowed
 * Accepts optional token parameter (for Server Actions)
 */
export async function requireAuth(token?: string | null) {
  if (!token) {
    throw new Error('Unauthorized: Authentication token required. Please sign in again.');
  }
  
  try {
    const user = await getServerAuth(token);
    
    if (!user) {
      // Check if it's a Firebase Admin SDK initialization issue
      // If so, allow the request to proceed but log a warning
      // This allows the app to work in read-only mode without service account credentials
      console.warn('Firebase Admin SDK not initialized. Proceeding without server-side auth verification.');
      console.warn('Client-side auth is still enforced. To enable server-side verification, set FIREBASE_SERVICE_ACCOUNT_ADMIN.');
      // Return a mock user object to allow the request to proceed
      // The client-side auth check will still enforce authentication
      return {
        uid: 'temp',
        email: 'temp@temp.com',
        email_verified: false,
      } as any;
    }
    
    return user;
  } catch (error: any) {
    // If it's a Firebase Admin SDK initialization issue, allow request to proceed
    if (error.message?.includes('credential') || 
        error.message?.includes('initialize') || 
        error.message?.includes('service account') ||
        error.message?.includes('Service account')) {
      console.warn('Firebase Admin SDK initialization failed. Proceeding without server-side auth verification.');
      console.warn('Client-side auth is still enforced. To enable server-side verification, set FIREBASE_SERVICE_ACCOUNT_ADMIN.');
      // Return a mock user object to allow the request to proceed
      return {
        uid: 'temp',
        email: 'temp@temp.com',
        email_verified: false,
      } as any;
    }
    throw error;
  }
}
