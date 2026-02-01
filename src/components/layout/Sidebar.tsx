'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useProject } from '@/contexts/ProjectContext';
import { Badge } from '@/components/ui/Badge';

const navigationItems = [
  { href: 'overview', label: 'Overview' },
  { href: 'calendar', label: 'Calendar' },
  { href: 'meetings', label: 'Meetings' },
  { href: 'bugs', label: 'Bugs' },
  { href: 'features', label: 'Features' },
  { href: 'tasks', label: 'Tasks' },
  { href: 'content', label: 'Content' },
  { href: 'documents', label: 'Documents' },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { project } = useProject();

  if (!project) {
    return (
      <div className="w-64 bg-background-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Select a Project</div>
        </div>
      </div>
    );
  }

  const projectId = project.id;
  const accentClasses = project.accentClasses;

  return (
    <div className="w-64 bg-background-card/80 backdrop-blur-sm border-r border-border-subtle flex flex-col">
      {/* Active Project Indicator */}
      <div className="p-5 border-b border-border-subtle bg-gradient-to-br from-background-card to-background-card/50">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold">Active Project</div>
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-notion', accentClasses.bg)}>
          <div className={cn('w-2 h-2 rounded-full', accentClasses.bg.replace('/10', ''))} />
          <Badge variant="accent" className={cn(accentClasses.badge, 'font-semibold border-0')}>
            {project.displayName}
          </Badge>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navigationItems.map((item) => {
          const href = `/admin/${projectId}/${item.href}`;
          const isActive = pathname === href || pathname?.startsWith(href + '/');
          
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'flex items-center px-3 py-2.5 text-sm font-medium rounded-notion transition-all duration-200 relative',
                isActive
                  ? cn(accentClasses.bg, accentClasses.text, 'font-semibold shadow-sm')
                  : 'text-gray-400 hover:text-gray-200 hover:bg-background-hover'
              )}
            >
              {isActive && (
                <div className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full', accentClasses.bg.replace('/10', ''))} />
              )}
              <span className="ml-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
