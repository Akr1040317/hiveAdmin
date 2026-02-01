import { headers } from 'next/headers';
import { getAdminAuth } from './server-config';

/**
 * Verify the current user's authentication token from admin Firebase
 * Gets token from Authorization header or accepts token parameter
 * Returns the decoded token if valid, null otherwise
 */
export async function getServerAuth(token?: string) {
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
      // If it's a credential error, provide helpful message
      if (verifyError.message?.includes('credential') || verifyError.message?.includes('initialize')) {
        console.error('Firebase Admin SDK initialization issue. Make sure ADMIN_FIREBASE_PROJECT_ID is set.');
      }
      return null;
    }
  } catch (error: any) {
    console.error('Error in getServerAuth:', error.message || error);
    return null;
  }
}

/**
 * Check if user is authenticated and allowed
 * Accepts optional token parameter (for Server Actions)
 */
export async function requireAuth(token?: string) {
  if (!token) {
    throw new Error('Unauthorized: Authentication token required. Please sign in again.');
  }
  
  try {
    const user = await getServerAuth(token);
    
    if (!user) {
      throw new Error('Unauthorized: Invalid or expired authentication token. Please sign in again.');
    }
    
    return user;
  } catch (error: any) {
    // Provide helpful error message if it's a Firebase Admin SDK initialization issue
    if (error.message?.includes('credential') || error.message?.includes('initialize') || error.message?.includes('service account')) {
      throw new Error(
        'Server authentication setup incomplete. ' +
        'Please set up the admin Firebase service account. ' +
        'See SETUP_ADMIN_SERVICE_ACCOUNT.md for instructions.'
      );
    }
    throw error;
  }
}
