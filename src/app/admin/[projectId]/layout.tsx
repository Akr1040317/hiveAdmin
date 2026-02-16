'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectId, getProject } from '@/lib/projects';
import { canAccessProject } from '@/lib/team-members';
import { AdminLayout } from '@/components/layout/AdminLayout';

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const projectId = params.projectId as string;

  useEffect(() => {
    if (loading) return;
    const project = getProject(projectId as ProjectId);
    if (!project) {
      router.push('/admin');
      return;
    }
    if (!canAccessProject(user?.email ?? null, projectId as ProjectId)) {
      router.push('/admin');
    }
  }, [projectId, router, user?.email, loading]);

  const project = getProject(projectId as ProjectId);
  if (!project) {
    return null; // Will redirect
  }
  if (!loading && user && !canAccessProject(user.email ?? null, projectId as ProjectId)) {
    return null; // Will redirect
  }

  // Wrap AdminLayout with ProjectProvider so Sidebar and Header have access to project context
  return (
    <ProjectProvider projectId={projectId as ProjectId}>
      <AdminLayout>{children}</AdminLayout>
    </ProjectProvider>
  );
}
