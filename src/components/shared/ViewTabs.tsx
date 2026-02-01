'use client';

import React from 'react';
import { ViewType } from '@/lib/views';
import { Button } from '@/components/ui/Button';
import { Plus, MoreVertical, Grid3x3, Table as TableIcon, Calendar } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { useProject } from '@/contexts/ProjectContext';
import { useView } from '@/contexts/ViewContext';

interface ViewTabsProps {
  availableViewTypes: ViewType[];
  onViewTypeChange: (viewType: ViewType) => void;
  onCreateView?: () => void;
  onRenameView?: () => void;
  onDeleteView?: () => void;
  accent?: 'purple' | 'orange' | 'blue' | boolean;
}

export function ViewTabs({
  availableViewTypes,
  onViewTypeChange,
  onCreateView,
  onRenameView,
  onDeleteView,
  accent = false,
}: ViewTabsProps) {
  const { project } = useProject();
  const { currentView, views } = useView();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const getAccentColor = () => {
    if (accent === true) return 'purple';
    if (typeof accent === 'string') return accent;
    return project?.accentColorKey || 'purple';
  };

  const accentColor = getAccentColor();
  const accentClasses = project?.accentClasses;

  const viewTypeLabels: Record<ViewType, string> = {
    table: 'Table',
    board: 'Kanban',
    calendar: 'Calendar',
  };

  const viewTypeIcons: Record<ViewType, React.ReactNode> = {
    table: <TableIcon className="w-4 h-4" />,
    board: <Grid3x3 className="w-4 h-4" />,
    calendar: <Calendar className="w-4 h-4" />,
  };

  return (
    <div className="flex items-center gap-1 border-b border-border-subtle px-6 bg-background-card/30">
      {availableViewTypes.map((viewType) => {
        const isActive = currentView?.viewType === viewType;
        return (
          <button
            key={viewType}
            onClick={() => onViewTypeChange(viewType)}
            className={cn(
              'px-4 py-3 text-sm font-semibold transition-all duration-200 relative',
              'hover:text-gray-200',
              isActive 
                ? 'text-gray-50' 
                : 'text-gray-400 hover:bg-background-hover/50'
            )}
          >
            <span className="flex items-center gap-2">
              {viewTypeIcons[viewType]}
              {viewTypeLabels[viewType]}
            </span>
            {isActive && (
              <div
                className={cn(
                  'absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full',
                  accentColor === 'purple' && 'bg-gradient-to-r from-violet-500 to-purple-500',
                  accentColor === 'orange' && 'bg-gradient-to-r from-orange-500 to-red-500',
                  accentColor === 'blue' && 'bg-gradient-to-r from-blue-500 to-cyan-500'
                )}
              />
            )}
          </button>
        );
      })}

      {/* View name and menu */}
      {currentView && (
        <>
          <div className="h-4 w-px bg-border-subtle mx-2" />
          <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Popover.Trigger asChild>
              <button className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-gray-200 flex items-center gap-1.5">
                {currentView.viewName}
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 w-48 p-1 bg-background-card border border-border rounded-notion-lg shadow-lg"
                sideOffset={5}
              >
                <div className="space-y-0.5">
                  {onRenameView && (
                    <button
                      onClick={() => {
                        onRenameView();
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-notion text-xs text-gray-300 hover:bg-background-hover"
                    >
                      Rename view
                    </button>
                  )}
                  {onCreateView && (
                    <button
                      onClick={() => {
                        onCreateView();
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-notion text-xs text-gray-300 hover:bg-background-hover"
                    >
                      Duplicate view
                    </button>
                  )}
                  {onDeleteView && views.length > 1 && (
                    <>
                      <div className="h-px bg-border-subtle my-1" />
                      <button
                        onClick={() => {
                          onDeleteView();
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-notion text-xs text-red-400 hover:bg-background-hover"
                      >
                        Delete view
                      </button>
                    </>
                  )}
                </div>
                <Popover.Arrow className="fill-background-card" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </>
      )}

      {/* Add view button */}
      {onCreateView && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onCreateView}
          className="h-7 w-7 p-0 ml-auto"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}
