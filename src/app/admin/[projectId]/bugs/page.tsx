'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { ViewProvider, useView } from '@/contexts/ViewContext';
import { ViewToolbar } from '@/components/shared/ViewToolbar';
import { ViewTabs } from '@/components/shared/ViewTabs';
import { TableView, TableColumn } from '@/components/shared/TableView';
import { BoardView } from '@/components/shared/BoardView';
import { CalendarView } from '@/components/shared/CalendarView';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { Bug, getBugs, createBug, updateBug, deleteBug } from '@/app/actions/bugs';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Filter, Sort } from '@/lib/views';
import { format } from 'date-fns';

function BugsContent() {
  const { project, projectId } = useProject();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);

  const { execute: loadBugs, loading } = useServerAction(getBugs);
  const { execute: handleCreateBug } = useServerAction(createBug);
  const { execute: handleUpdateBug } = useServerAction(updateBug);
  const { execute: handleDeleteBug } = useServerAction(deleteBug);

  useEffect(() => {
    if (projectId) {
      loadBugs(projectId).then((data) => {
        if (data) setBugs(data);
      });
    }
  }, [projectId]);

  // Apply default filter: exclude verified unless toggled
  useEffect(() => {
    const hasVerifiedFilter = filters.some(f => f.field === 'status' && f.value === 'verified');
    if (!hasVerifiedFilter && filters.length === 0) {
      setFilters([{
        id: 'default',
        field: 'status',
        operator: 'not_equals',
        value: 'verified',
      }]);
    }
  }, []);

  // Apply filters and search
  const filteredBugs = useMemo(() => {
    let result = bugs;

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(bug =>
        bug.title.toLowerCase().includes(searchLower) ||
        bug.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply filters
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(bug => (bug as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(bug => (bug as any)[filter.field] !== filter.value);
      } else if (filter.operator === 'contains') {
        const val = String((bug as any)[filter.field] || '').toLowerCase();
        result = result.filter(bug => val.includes(String(filter.value).toLowerCase()));
      }
    });

    return result;
  }, [bugs, search, filters]);

  const handleCreate = async (data: Partial<Bug>) => {
    if (!projectId) return;
    const newBug: Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
      title: data.title || 'Untitled Bug',
      description: data.description || '',
      platform: data.platform || 'web',
      severity: data.severity || 'medium',
      status: data.status || 'reported',
      tags: data.tags || [],
      order: bugs.length,
    };
    await handleCreateBug(projectId, newBug);
    const updated = await loadBugs(projectId);
    if (updated) setBugs(updated);
    setIsDrawerOpen(false);
  };

  const handleUpdate = async (updates: Partial<Bug>) => {
    if (!projectId || !selectedBug) return;
    await handleUpdateBug(projectId, selectedBug.id, updates);
    const updated = await loadBugs(projectId);
    if (updated) setBugs(updated);
    setSelectedBug({ ...selectedBug, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedBug) return;
    if (confirm('Are you sure you want to delete this bug?')) {
      await handleDeleteBug(projectId, selectedBug.id);
      const updated = await loadBugs(projectId);
      if (updated) setBugs(updated);
      setIsDrawerOpen(false);
      setSelectedBug(null);
    }
  };

  const handleCardMove = async (bugId: string, newStatus: Bug['status']) => {
    if (!projectId) return;
    const bug = bugs.find(b => b.id === bugId);
    if (!bug) return;
    
    await handleUpdateBug(projectId, bugId, { status: newStatus });
    const updated = await loadBugs(projectId);
    if (updated) setBugs(updated);
  };

  const availableFields = [
    { value: 'title', label: 'Title', type: 'text' as const },
    { value: 'status', label: 'Status', type: 'select' as const },
    { value: 'severity', label: 'Severity', type: 'select' as const },
    { value: 'platform', label: 'Platform', type: 'select' as const },
    { value: 'updatedAt', label: 'Updated', type: 'date' as const },
    { value: 'createdBy', label: 'Created By', type: 'text' as const },
  ];

  const statusOptions = [
    { value: 'reported', label: 'Reported' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'fixed', label: 'Fixed' },
    { value: 'verified', label: 'Verified' },
  ];

  const severityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const platformOptions = [
    { value: 'ios', label: 'iOS' },
    { value: 'web', label: 'Web' },
    { value: 'admin', label: 'Admin' },
    { value: 'backend', label: 'Backend' },
  ];

  const tableColumns: TableColumn<Bug>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (bug) => (
        <div>
          <div className="font-medium text-sm text-gray-50">{bug.title}</div>
          <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{bug.description}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      type: 'select',
      options: statusOptions,
      onEdit: (bug, value) => handleCardMove(bug.id, value as Bug['status']),
    },
    {
      key: 'severity',
      header: 'Severity',
      sortable: true,
      type: 'badge',
      render: (bug) => {
        const colors: Record<string, string> = {
          critical: 'bg-red-500/20 text-red-400 border-red-500/40',
          high: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
          medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
          low: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
        };
        return (
          <Badge className={cn('text-xs capitalize', colors[bug.severity])}>
            {bug.severity}
          </Badge>
        );
      },
    },
    {
      key: 'platform',
      header: 'Platform',
      sortable: true,
      type: 'badge',
      render: (bug) => (
        <Badge variant="secondary" className="text-xs uppercase">
          {bug.platform}
        </Badge>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      type: 'date',
      render: (bug) => (
        <span className="text-xs text-gray-400">
          {format(new Date(bug.updatedAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Created By',
      sortable: true,
      render: (bug) => (
        <span className="text-xs text-gray-400">{bug.createdBy}</span>
      ),
    },
  ];

  const boardColumns = [
    { id: 'reported', title: 'NEW', status: 'reported' },
    { id: 'in_progress', title: 'IN PROGRESS', status: 'in_progress' },
    { id: 'blocked', title: 'IN REVIEW', status: 'blocked' },
    { id: 'fixed', title: 'COMPLETED', status: 'fixed' },
    { id: 'verified', title: 'VERIFIED', status: 'verified' },
  ];

  const viewType = currentView?.viewType || 'table';
  const accent = project?.accentColorKey || false;

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
          <div>
            <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>
              Bugs
            </h1>
            <p className="text-sm text-gray-400">
              Track and manage bugs across platforms
            </p>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <ViewTabs
        availableViewTypes={['table', 'board', 'calendar']}
        onViewTypeChange={switchViewType}
        accent={accent}
      />

      {/* Toolbar */}
      <ViewToolbar
        searchValue={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        sorts={sorts}
        onSortsChange={(newSorts) => {
          setSorts(newSorts);
          updateCurrentView({ sorts: newSorts });
        }}
        availableFields={availableFields}
        visibleColumns={currentView?.visibleColumns}
        onColumnsChange={(cols) => updateCurrentView({ visibleColumns: cols })}
        onNew={() => {
          setSelectedBug(null);
          setIsDrawerOpen(true);
        }}
        viewType={viewType}
        accent={accent}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading bugs...</div>
        ) : viewType === 'table' ? (
          <TableView
            data={filteredBugs}
            columns={tableColumns}
            sorts={sorts}
            onSortChange={(newSorts) => {
              setSorts(newSorts);
              updateCurrentView({ sorts: newSorts });
            }}
            visibleColumns={currentView?.visibleColumns}
            onRowClick={(bug) => {
              setSelectedBug(bug);
              setIsDrawerOpen(true);
            }}
            onQuickAdd={() => {
              setSelectedBug(null);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No bugs found. Create your first bug!"
            accent={accent}
          />
        ) : viewType === 'board' ? (
          <BoardView
            data={filteredBugs}
            columns={boardColumns}
            getCardData={(bug) => ({
              title: bug.title,
              subtitle: bug.description ? bug.description.substring(0, 60) + (bug.description.length > 60 ? '...' : '') : undefined,
              badges: [
                { 
                  label: bug.severity.charAt(0).toUpperCase() + bug.severity.slice(1), 
                  variant: bug.severity as 'critical' | 'high' | 'medium' | 'low'
                },
                { 
                  label: bug.platform.toUpperCase(), 
                  variant: 'secondary' 
                },
              ],
              updatedAt: bug.updatedAt,
              userId: bug.createdBy?.split('@')[0] || 'user',
            })}
            onCardClick={(bug) => {
              setSelectedBug(bug);
              setIsDrawerOpen(true);
            }}
            onCardMove={handleCardMove}
            onAddCard={(status) => {
              setSelectedBug({ ...selectedBug, status: status as Bug['status'] } as Bug);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No bugs found. Create your first bug!"
            accent={accent}
          />
        ) : (
          <CalendarView
            data={filteredBugs}
            getDate={(bug) => bug.updatedAt ? new Date(bug.updatedAt) : new Date(bug.createdAt)}
            getTitle={(bug) => bug.title}
            getStatus={(bug) => bug.status}
            getColor={(bug) => {
              if (bug.severity === 'critical') return '#ef4444'; // red
              if (bug.severity === 'high') return '#f97316'; // orange
              if (bug.severity === 'medium') return '#eab308'; // yellow
              return '#22c55e'; // green
            }}
            onItemClick={(bug) => {
              setSelectedBug(bug);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No bugs found. Create your first bug!"
            accent={accent}
          />
        )}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedBug(null);
        }}
        title={selectedBug?.title || 'New Bug'}
        onTitleChange={(title) => {
          if (selectedBug) {
            handleUpdate({ title });
          }
        }}
        properties={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: selectedBug?.status || 'reported',
            options: statusOptions,
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ status: value as Bug['status'] });
              }
            },
          },
          {
            key: 'severity',
            label: 'Severity',
            type: 'select',
            value: selectedBug?.severity || 'medium',
            options: severityOptions,
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ severity: value as Bug['severity'] });
              }
            },
          },
          {
            key: 'platform',
            label: 'Platform',
            type: 'select',
            value: selectedBug?.platform || 'web',
            options: platformOptions,
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ platform: value as Bug['platform'] });
              }
            },
          },
        ]}
        bodyFields={[
          {
            key: 'description',
            label: 'Description',
            value: selectedBug?.description || '',
            onChange: (value) => {
              if (selectedBug) {
                handleUpdate({ description: value });
              }
            },
            placeholder: 'Describe the bug...',
          },
        ]}
        metadata={selectedBug ? {
          createdAt: selectedBug.createdAt,
          updatedAt: selectedBug.updatedAt,
          createdBy: selectedBug.createdBy,
        } : undefined}
        onSave={() => {
          if (selectedBug) {
            setIsDrawerOpen(false);
          } else {
            handleCreate({ title: 'Untitled Bug' });
          }
        }}
        onDelete={selectedBug ? handleDelete : undefined}
        accent={accent}
      />
    </div>
  );
}

export default function BugsPage() {
  const { projectId } = useProject();
  
  return (
    <ViewProvider moduleName="bugs" defaultViewType="board">
      <BugsContent />
    </ViewProvider>
  );
}
