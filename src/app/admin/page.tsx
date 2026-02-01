'use client';

import { useRouter } from 'next/navigation';
import { getAllProjects } from '@/lib/projects';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export default function AdminPage() {
  const router = useRouter();
  const projects = getAllProjects();

  const handleProjectClick = (projectId: string) => {
    router.push(`/admin/${projectId}/overview`);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Select a Project</h1>
        <p className="text-gray-400">Choose a project to manage</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map((project) => {
          const accentClasses = project.accentClasses;
          return (
            <Card
              key={project.id}
              accent
              className={cn(
                'cursor-pointer transition-all hover:scale-105',
                accentClasses.hover
              )}
              onClick={() => handleProjectClick(project.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{project.displayName}</CardTitle>
                  <Badge variant="accent" className={cn(accentClasses.badge)}>
                    {project.accentColorKey}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">
                  Manage bugs, features, content, meetings, documents, and calendar for this project.
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
