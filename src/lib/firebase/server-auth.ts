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
      return null;
    }
    
    // Verify the token using admin Firebase
    const adminAuth = getAdminAuth('admin');
    const decodedToken = await adminAuth.verifyIdToken(authToken);
    
    return decodedToken;
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
}

/**
 * Check if user is authenticated and allowed
 * Accepts optional token parameter (for Server Actions)
 */
export async function requireAuth(token?: string) {
  const user = await getServerAuth(token);
  
  if (!user) {
    throw new Error('Unauthorized: Authentication required');
  }
  
  return user;
}
