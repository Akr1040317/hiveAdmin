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
    <div className="w-64 bg-background-card border-r border-border flex flex-col">
      {/* Active Project Indicator */}
      <div className="p-4 border-b border-border">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Active Project</div>
        <Badge variant="accent" className={cn(accentClasses.badge, 'w-full justify-center py-2')}>
          {project.displayName}
        </Badge>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigationItems.map((item) => {
          const href = `/admin/${projectId}/${item.href}`;
          const isActive = pathname === href || pathname?.startsWith(href + '/');
          
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? cn(accentClasses.bg, accentClasses.text, 'border-l-2', accentClasses.border)
                  : 'text-gray-400 hover:text-gray-200 hover:bg-background-hover'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
