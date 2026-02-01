'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getAllProjects } from '@/lib/projects';
import { cn } from '@/lib/utils';

export const Header: React.FC = () => {
  const { project } = useProject();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showSwitcher, setShowSwitcher] = useState(false);
  const allProjects = getAllProjects();

  if (!project) {
    return (
      <header className="h-16 border-b border-border bg-background-card flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Hive Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>
    );
  }

  const accentClasses = project.accentClasses;

  const handleProjectSwitch = (projectId: string) => {
    router.push(`/admin/${projectId}/overview`);
    setShowSwitcher(false);
  };

  return (
    <header className={cn('h-16 border-b border-border bg-background-card flex items-center justify-between px-6', accentClasses.border)}>
      <div className="flex items-center gap-4">
        {/* Active Project Badge */}
        <div className="relative">
          <button
            onClick={() => setShowSwitcher(!showSwitcher)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors',
              accentClasses.hover
            )}
          >
            <Badge variant="accent" className={cn(accentClasses.badge)}>
              {project.displayName}
            </Badge>
            <span className="text-gray-400 text-sm">▼</span>
          </button>

          {/* Project Switcher Dropdown */}
          {showSwitcher && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-background-card border border-border rounded-md shadow-lg z-50">
              <div className="p-2 space-y-1">
                {allProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProjectSwitch(p.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                      p.id === project.id
                        ? cn(p.accentClasses.bg, p.accentClasses.text)
                        : 'text-gray-400 hover:text-gray-200 hover:bg-background-hover'
                    )}
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Info & Logout */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={logout}>
          Logout
        </Button>
      </div>
    </header>
  );
};
