'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { signInWithGoogle, signOut as firebaseSignOut } from '@/lib/firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAllowed: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  checkAllowlist: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAllowed, setIsAllowed] = useState(false);

  // Timeout fallback to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timeout - forcing loading to false');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  const checkAllowlist = async (email: string): Promise<boolean> => {
    try {
      // First check env var
      const envAllowlist = process.env.NEXT_PUBLIC_ALLOWED_EMAILS;
      if (envAllowlist) {
        const emails = envAllowlist.split(',').map(e => e.trim());
        if (emails.includes(email)) {
          return true;
        }
      }

      // Then check Firestore (if available and user is authenticated)
      try {
        const allowlistDoc = await getDoc(doc(db, 'config', 'allowlist'));
        if (allowlistDoc.exists()) {
          const emails = allowlistDoc.data().emails || [];
          return emails.includes(email);
        }
      } catch (firestoreError: any) {
        // If Firestore read fails (permissions, network, etc.), fall back to env var only
        console.warn('Firestore allowlist check failed, using env var only:', firestoreError.message);
        // If env var was already checked and didn't match, return false
        return false;
      }

      // If neither env var nor Firestore has the email, deny access
      return false;
    } catch (err) {
      console.error('Error checking allowlist:', err);
      // On any error, deny access for security
      return false;
    }
  };

  useEffect(() => {
    if (!auth) {
      console.error('Firebase auth not initialized');
      setLoading(false);
      setError('Firebase not initialized. Please check your configuration.');
      return;
    }

    console.log('Setting up auth state observer...');
    let mounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!mounted) return;
        
        console.log('Auth state changed:', currentUser ? currentUser.email : 'no user');
        setLoading(true);
        setError(null);

        try {
          if (currentUser) {
            console.log('Checking allowlist for:', currentUser.email);
            const allowed = await checkAllowlist(currentUser.email || '');
            console.log('Allowlist check result:', allowed);
            setIsAllowed(allowed);
            setUser(allowed ? currentUser : null);
            
            if (!allowed) {
              setError('Access denied. Your email is not on the allowlist.');
              await firebaseSignOut();
            }
          } else {
            console.log('No user authenticated');
            setUser(null);
            setIsAllowed(false);
          }
        } catch (err: any) {
          console.error('Auth state change error:', err);
          setError(err.message || 'Authentication error');
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      },
      (error) => {
        console.error('Auth state observer error:', error);
        if (mounted) {
          setError('Authentication error. Please try again.');
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = async () => {
    try {
      setError(null);
      await signInWithGoogle();
      // Auth state change will handle the rest
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await firebaseSignOut();
      setUser(null);
      setIsAllowed(false);
    } catch (err: any) {
      setError(err.message || 'Failed to sign out');
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAllowed,
        login,
        logout,
        checkAllowlist,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
