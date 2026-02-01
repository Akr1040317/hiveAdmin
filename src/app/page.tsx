'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/admin');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <AuthLayout>
        <div className="text-center text-gray-400">Loading...</div>
      </AuthLayout>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
