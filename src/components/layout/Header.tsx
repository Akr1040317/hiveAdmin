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
    <header className={cn('h-16 border-b border-border-subtle bg-gradient-to-r from-background-card to-background-card/80 backdrop-blur-sm flex items-center justify-between px-6 shadow-sm')}>
      <div className="flex items-center gap-4">
        {/* Active Project Badge */}
        <div className="relative">
          <button
            onClick={() => setShowSwitcher(!showSwitcher)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-notion transition-all duration-200 hover:scale-105',
              accentClasses.hover
            )}
          >
            <div className={cn('w-2 h-2 rounded-full mr-1.5', accentClasses.bg.replace('/10', ''))} />
            <Badge variant="accent" className={cn(accentClasses.badge, 'font-semibold px-3 py-1')}>
              {project.displayName}
            </Badge>
            <span className="text-gray-400 text-xs">▼</span>
          </button>

          {/* Project Switcher Dropdown */}
          {showSwitcher && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-background-card border border-border-subtle rounded-notion-lg shadow-xl z-50 backdrop-blur-sm">
              <div className="p-2 space-y-1">
                {allProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProjectSwitch(p.id)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm rounded-notion transition-all duration-200 flex items-center gap-2',
                      p.id === project.id
                        ? cn(p.accentClasses.bg, p.accentClasses.text, 'font-semibold shadow-sm')
                        : 'text-gray-400 hover:text-gray-200 hover:bg-background-hover'
                    )}
                  >
                    <div className={cn('w-2 h-2 rounded-full', p.accentClasses.bg.replace('/10', ''))} />
                    {p.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Info & Logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-notion bg-background-card/50 border border-border-subtle">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="text-sm text-gray-300 font-medium">{user?.email?.split('@')[0] || 'User'}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="hover:bg-red-500/10 hover:text-red-400">
          Logout
        </Button>
      </div>
    </header>
  );
};
