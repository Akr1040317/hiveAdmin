'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { ProjectId, getProject } from '@/lib/projects';

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  useEffect(() => {
    // Validate projectId
    const project = getProject(projectId as ProjectId);
    if (!project) {
      router.push('/admin');
    }
  }, [projectId, router]);

  const project = getProject(projectId as ProjectId);
  if (!project) {
    return null; // Will redirect
  }

  // AdminLayout is already provided by parent admin/layout.tsx
  return (
    <ProjectProvider projectId={projectId as ProjectId}>
      {children}
    </ProjectProvider>
  );
}
