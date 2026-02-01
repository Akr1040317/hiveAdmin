'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/layout/AdminLayout';

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isAllowed } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Check if we're on a project route (has projectId)
  const isProjectRoute = pathname?.includes('/admin/') && pathname.split('/').length > 3;

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/');
      } else if (!isAllowed) {
        // Access denied - will be shown by AuthContext error
        // User will be signed out automatically
      }
    }
  }, [user, loading, isAllowed, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!user || !isAllowed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
          <p className="text-gray-400">Your email is not on the allowlist.</p>
        </div>
      </div>
    );
  }

  // For project routes, don't wrap with AdminLayout here (it will be wrapped in [projectId]/layout.tsx)
  // For /admin page, wrap with AdminLayout
  if (isProjectRoute) {
    return <>{children}</>;
  }

  return <AdminLayout>{children}</AdminLayout>;
}
