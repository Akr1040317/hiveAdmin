'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAllowedProjectsForUser } from '@/lib/team-members';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const projects = getAllowedProjectsForUser(user?.email ?? null);

  const handleProjectClick = (projectId: string) => {
    router.push(`/admin/${projectId}/overview`);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-gray-50 mb-3 bg-gradient-to-r from-gray-50 to-gray-400 bg-clip-text text-transparent">
          Select a Project
        </h1>
        <p className="text-gray-400 text-lg">Choose a project to manage and track</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map((project) => {
          const accentClasses = project.accentClasses;
          const gradientMap: Record<string, string> = {
            purple: 'from-violet-500/20 via-purple-500/10 to-pink-500/20',
            orange: 'from-orange-500/20 via-red-500/10 to-pink-500/20',
            blue: 'from-blue-500/20 via-cyan-500/10 to-purple-500/20',
          };
          const gradient = gradientMap[project.accentColorKey] || gradientMap.purple;
          
          return (
            <Card
              key={project.id}
              className={cn(
                'cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl',
                'bg-gradient-to-br', gradient,
                'border-2 border-border-subtle hover:border-border-light',
                'group'
              )}
              onClick={() => handleProjectClick(project.id)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-3 h-3 rounded-full', accentClasses.bg.replace('/10', ''))} />
                    <CardTitle className="text-xl font-bold text-gray-50 group-hover:scale-105 transition-transform">
                      {project.displayName}
                    </CardTitle>
                  </div>
                  <Badge variant="accent" className={cn(accentClasses.badge, 'font-semibold')}>
                    {project.accentColorKey}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Manage bugs, features, content pipeline, meetings, documents, and calendar for this project.
                </p>
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <div className="flex flex-wrap gap-2">
                    {['Bugs', 'Features', 'Content', 'Meetings', 'Documents', 'Calendar'].map((item) => (
                      <span key={item} className="text-xs px-2 py-1 bg-background-card/50 rounded-notion text-gray-400">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
