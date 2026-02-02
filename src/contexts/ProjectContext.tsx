'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { getProject, ProjectConfig, ProjectId } from '@/lib/projects';

interface ProjectContextType {
  project: ProjectConfig | null;
  projectId: ProjectId | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({
  projectId,
  children,
}: {
  projectId: ProjectId;
  children: ReactNode;
}) {
  const project = getProject(projectId) ?? null;

  return (
    <ProjectContext.Provider value={{ project, projectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  // Return null project if not in provider (for /admin page)
  if (context === undefined) {
    return { project: null, projectId: null };
  }
  return context;
}
