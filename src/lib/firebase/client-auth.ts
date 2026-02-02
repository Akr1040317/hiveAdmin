import { auth } from './config';
import { User } from 'firebase/auth';

/**
 * Get the current user's ID token for server actions
 */
export async function getIdToken(): Promise<string | null> {
  if (!auth) {
    return null;
  }
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
}

/**
 * Get the current user
 */
export function getCurrentUser(): User | null {
  if (!auth) {
    return null;
  }
  return auth.currentUser;
}
