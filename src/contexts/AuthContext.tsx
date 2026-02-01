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

      // Then check Firestore
      const allowlistDoc = await getDoc(doc(db, 'config', 'allowlist'));
      if (allowlistDoc.exists()) {
        const emails = allowlistDoc.data().emails || [];
        return emails.includes(email);
      }

      return false;
    } catch (err) {
      console.error('Error checking allowlist:', err);
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError(null);

      if (currentUser) {
        const allowed = await checkAllowlist(currentUser.email || '');
        setIsAllowed(allowed);
        setUser(allowed ? currentUser : null);
        
        if (!allowed) {
          setError('Access denied. Your email is not on the allowlist.');
          await firebaseSignOut();
        }
      } else {
        setUser(null);
        setIsAllowed(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
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
