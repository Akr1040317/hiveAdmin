'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FilterBuilder } from './FilterBuilder';
import { SortBuilder } from './SortBuilder';
import { Filter, Sort } from '@/lib/views';
import { Search, Filter as FilterIcon, ArrowUpDown, Columns, Group, Plus, X } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { useProject } from '@/contexts/ProjectContext';

interface ViewToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
  sorts: Sort[];
  onSortsChange: (sorts: Sort[]) => void;
  availableFields: { value: string; label: string; type?: 'text' | 'select' | 'date' | 'number' }[];
  visibleColumns?: string[];
  onColumnsChange?: (columns: string[]) => void;
  onNew?: () => void;
  showGroup?: boolean;
  onGroupChange?: (groupBy: string) => void;
  groupBy?: string;
  viewType?: 'table' | 'board' | 'calendar';
  accent?: 'purple' | 'orange' | 'blue' | boolean;
  sticky?: boolean;
}

export function ViewToolbar({
  searchValue,
  onSearchChange,
  filters,
  onFiltersChange,
  sorts,
  onSortsChange,
  availableFields,
  visibleColumns,
  onColumnsChange,
  onNew,
  showGroup = false,
  onGroupChange,
  groupBy,
  viewType = 'table',
  accent = false,
  sticky = true,
}: ViewToolbarProps) {
  const { project } = useProject();
  const [debouncedSearch, setDebouncedSearch] = useState(searchValue);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(debouncedSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearch, onSearchChange]);

  const getAccentColor = () => {
    if (accent === true) return 'purple';
    if (typeof accent === 'string') return accent;
    return project?.accentColorKey || 'purple';
  };

  const accentColor = getAccentColor();

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-6 py-3 bg-background-card/50 border-b border-border-subtle backdrop-blur-sm',
        sticky && 'sticky top-0 z-10'
      )}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <Input
          value={debouncedSearch}
          onChange={(e) => setDebouncedSearch(e.target.value)}
          placeholder="Search..."
          className="pl-8 h-8 text-sm"
          accent={accent}
        />
      </div>

      {/* Filter */}
      <Popover.Root open={filterOpen} onOpenChange={setFilterOpen}>
        <Popover.Trigger asChild>
          <Button
            size="sm"
            variant={filters.length > 0 ? 'primary' : 'secondary'}
            className={cn(
              'h-8 gap-1.5',
              filters.length > 0 && `bg-${accentColor}-600 hover:bg-${accentColor}-700`
            )}
            accent={filters.length > 0 ? accent : false}
          >
            <FilterIcon className="w-3.5 h-3.5" />
            <span className="text-xs">Filter</span>
            {filters.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/20">
                {filters.length}
              </span>
            )}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-50 w-80 p-4 bg-background-card border border-border rounded-notion-lg shadow-lg"
            sideOffset={5}
          >
            <FilterBuilder
              filters={filters}
              availableFields={availableFields}
              onChange={(newFilters) => {
                onFiltersChange(newFilters);
                if (newFilters.length === 0) {
                  setFilterOpen(false);
                }
              }}
              accent={accent}
            />
            <Popover.Arrow className="fill-background-card" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Sort */}
      <Popover.Root open={sortOpen} onOpenChange={setSortOpen}>
        <Popover.Trigger asChild>
          <Button
            size="sm"
            variant={sorts.length > 0 ? 'primary' : 'secondary'}
            className={cn(
              'h-8 gap-1.5',
              sorts.length > 0 && `bg-${accentColor}-600 hover:bg-${accentColor}-700`
            )}
            accent={sorts.length > 0 ? accent : false}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="text-xs">Sort</span>
            {sorts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/20">
                {sorts.length}
              </span>
            )}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="z-50 w-80 p-4 bg-background-card border border-border rounded-notion-lg shadow-lg"
            sideOffset={5}
          >
            <SortBuilder
              sorts={sorts}
              availableFields={availableFields}
              onChange={(newSorts) => {
                onSortsChange(newSorts);
                if (newSorts.length === 0) {
                  setSortOpen(false);
                }
              }}
              accent={accent}
            />
            <Popover.Arrow className="fill-background-card" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Columns (table only) */}
      {viewType === 'table' && onColumnsChange && (
        <Popover.Root open={columnsOpen} onOpenChange={setColumnsOpen}>
          <Popover.Trigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="text-xs">Columns</span>
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-50 w-64 p-4 bg-background-card border border-border rounded-notion-lg shadow-lg"
              sideOffset={5}
            >
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-300 mb-2">Visible Columns</div>
                {availableFields.map((field) => {
                  const isVisible = visibleColumns?.includes(field.value) ?? true;
                  return (
                    <label
                      key={field.value}
                      className="flex items-center gap-2 p-1.5 rounded-notion hover:bg-background-hover cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) => {
                          const current = visibleColumns || availableFields.map(f => f.value);
                          if (e.target.checked) {
                            onColumnsChange([...current, field.value]);
                          } else {
                            onColumnsChange(current.filter(c => c !== field.value));
                          }
                        }}
                        className="w-4 h-4 rounded border-border-subtle"
                      />
                      <span className="text-xs text-gray-300">{field.label}</span>
                    </label>
                  );
                })}
              </div>
              <Popover.Arrow className="fill-background-card" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}

      {/* Group (board only) */}
      {showGroup && viewType === 'board' && onGroupChange && (
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5"
            >
              <Group className="w-3.5 h-3.5" />
              <span className="text-xs">Group</span>
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-50 w-48 p-2 bg-background-card border border-border rounded-notion-lg shadow-lg"
              sideOffset={5}
            >
              <div className="space-y-1">
                {availableFields.map((field) => (
                  <button
                    key={field.value}
                    onClick={() => {
                      onGroupChange(field.value);
                    }}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded-notion text-xs transition-colors',
                      groupBy === field.value
                        ? 'bg-accent-purple-subtle text-accent-purple-light'
                        : 'text-gray-300 hover:bg-background-hover'
                    )}
                  >
                    {field.label}
                  </button>
                ))}
              </div>
              <Popover.Arrow className="fill-background-card" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}

      {/* New Button */}
      {onNew && (
        <Button
          size="sm"
          variant="primary"
          accent={accent}
          onClick={onNew}
          className="h-8 gap-1.5 ml-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-xs">New</span>
        </Button>
      )}
    </div>
  );
}
