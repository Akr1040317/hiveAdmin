'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { ViewProvider, useView } from '@/contexts/ViewContext';
import { ViewToolbar } from '@/components/shared/ViewToolbar';
import { ViewTabs } from '@/components/shared/ViewTabs';
import { TableView, TableColumn } from '@/components/shared/TableView';
import { CalendarView } from '@/components/shared/CalendarView';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { CalendarItem, getCalendarItems, createCalendarItem, updateCalendarItem, deleteCalendarItem } from '@/app/actions/calendar';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Filter, Sort } from '@/lib/views';
import { format } from 'date-fns';

function CalendarItemsContent() {
  const { project, projectId } = useProject();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);

  const { execute: loadCalendarItems, loading } = useServerAction(getCalendarItems);
  const { execute: handleCreateItem } = useServerAction(createCalendarItem);
  const { execute: handleUpdateItem } = useServerAction(updateCalendarItem);
  const { execute: handleDeleteItem } = useServerAction(deleteCalendarItem);

  useEffect(() => {
    if (projectId) {
      loadCalendarItems(projectId).then((data) => {
        if (data) setCalendarItems(data);
      });
    }
  }, [projectId]);

  const filteredItems = useMemo(() => {
    let result = calendarItems;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(searchLower) ||
        item.notes.toLowerCase().includes(searchLower)
      );
    }
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(item => (item as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(item => (item as any)[filter.field] !== filter.value);
      }
    });
    return result;
  }, [calendarItems, search, filters]);

  const handleCreate = async (data: Partial<CalendarItem>) => {
    if (!projectId) return;
    const newItem: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'> = {
      title: data.title || 'Untitled Event',
      type: data.type || 'event',
      date: data.date || new Date(),
      notes: data.notes || '',
      status: data.status || 'planned',
    };
    await handleCreateItem(projectId, newItem);
    const updated = await loadCalendarItems(projectId);
    if (updated) setCalendarItems(updated);
    setIsDrawerOpen(false);
  };

  const handleUpdate = async (updates: Partial<CalendarItem>) => {
    if (!projectId || !selectedItem) return;
    await handleUpdateItem(projectId, selectedItem.id, updates);
    const updated = await loadCalendarItems(projectId);
    if (updated) setCalendarItems(updated);
    setSelectedItem({ ...selectedItem, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedItem) return;
    if (confirm('Are you sure?')) {
      await handleDeleteItem(projectId, selectedItem.id);
      const updated = await loadCalendarItems(projectId);
      if (updated) setCalendarItems(updated);
      setIsDrawerOpen(false);
      setSelectedItem(null);
    }
  };

  const availableFields = [
    { value: 'title', label: 'Title', type: 'text' as const },
    { value: 'type', label: 'Type', type: 'select' as const },
    { value: 'status', label: 'Status', type: 'select' as const },
    { value: 'date', label: 'Date', type: 'date' as const },
  ];

  const typeOptions = [
    { value: 'deadline', label: 'Deadline' },
    { value: 'milestone', label: 'Milestone' },
    { value: 'event', label: 'Event' },
    { value: 'reminder', label: 'Reminder' },
  ];

  const statusOptions = [
    { value: 'planned', label: 'Planned' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
  ];

  const getTypeColor = (type: string): string => {
    const t = type.toLowerCase();
    if (t === 'deadline') return '#ef4444'; // red-500
    if (t === 'milestone') return '#8b5cf6'; // purple-500
    if (t === 'event') return '#3b82f6'; // blue-500
    if (t === 'reminder') return '#eab308'; // yellow-500
    return '#6b7280'; // gray-500
  };

  const tableColumns: TableColumn<CalendarItem>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-semibold text-sm text-gray-50">{item.title}</div>
          {item.notes && (
            <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{item.notes}</div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      type: 'badge',
      render: (item) => {
        const color = getTypeColor(item.type);
        return (
          <Badge className={cn(
            'text-xs capitalize',
            color === 'bg-red-500' && 'bg-red-500/20 text-red-400 border-red-500/40',
            color === 'bg-purple-500' && 'bg-purple-500/20 text-purple-400 border-purple-500/40',
            color === 'bg-blue-500' && 'bg-blue-500/20 text-blue-400 border-blue-500/40',
            color === 'bg-yellow-500' && 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
          )}>
            {item.type}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      type: 'badge',
      render: (item) => {
        const statusColors: Record<string, string> = {
          planned: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
          scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
          completed: 'bg-green-500/20 text-green-400 border-green-500/40',
        };
        return (
          <Badge className={cn('text-xs capitalize', statusColors[item.status])}>
            {item.status}
          </Badge>
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      type: 'date',
      render: (item) => (
        <span className="text-xs text-gray-400">
          {format(new Date(item.date), 'MMM d, yyyy')}
        </span>
      ),
    },
  ];

  const viewType = currentView?.viewType || 'calendar';
  const accent = project?.accentColorKey || false;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
          <div>
            <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Calendar</h1>
            <p className="text-sm text-gray-400">Important dates, deadlines, and milestones</p>
          </div>
        </div>
      </div>

      <ViewTabs availableViewTypes={['calendar', 'table']} onViewTypeChange={switchViewType} accent={accent} />

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
          setSelectedItem(null);
          setIsDrawerOpen(true);
        }}
        viewType={viewType}
        accent={accent}
      />

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading calendar items...</div>
        ) : viewType === 'calendar' ? (
          <CalendarView
            data={filteredItems}
            getDate={(item) => new Date(item.date)}
            getTitle={(item) => item.title}
            getStatus={(item) => item.status}
            getColor={(item) => getTypeColor(item.type)}
            onItemClick={(item) => {
              setSelectedItem(item);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No calendar items found. Create your first item!"
            accent={accent}
          />
        ) : (
          <TableView
            data={filteredItems}
            columns={tableColumns}
            sorts={sorts}
            onSortChange={(newSorts) => {
              setSorts(newSorts);
              updateCurrentView({ sorts: newSorts });
            }}
            visibleColumns={currentView?.visibleColumns}
            onRowClick={(item) => {
              setSelectedItem(item);
              setIsDrawerOpen(true);
            }}
            onQuickAdd={() => {
              setSelectedItem(null);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No calendar items found. Create your first item!"
            accent={accent}
          />
        )}
      </div>

      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedItem(null);
        }}
        title={selectedItem?.title || 'New Calendar Item'}
        onTitleChange={(title) => {
          if (selectedItem) handleUpdate({ title });
        }}
        properties={[
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            value: selectedItem?.type || 'event',
            options: typeOptions,
            onChange: (value) => {
              if (selectedItem) handleUpdate({ type: value as CalendarItem['type'] });
            },
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: selectedItem?.status || 'planned',
            options: statusOptions,
            onChange: (value) => {
              if (selectedItem) handleUpdate({ status: value as CalendarItem['status'] });
            },
          },
          {
            key: 'date',
            label: 'Date',
            type: 'date',
            value: selectedItem?.date ? format(new Date(selectedItem.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            onChange: (value) => {
              if (selectedItem) handleUpdate({ date: value ? new Date(value) : new Date() });
            },
          },
        ]}
        bodyFields={[
          {
            key: 'notes',
            label: 'Notes',
            value: selectedItem?.notes || '',
            onChange: (value) => {
              if (selectedItem) handleUpdate({ notes: value });
            },
            placeholder: 'Additional notes...',
          },
        ]}
        metadata={selectedItem ? {
          createdAt: selectedItem.createdAt,
          updatedAt: selectedItem.updatedAt,
        } : undefined}
        onSave={() => {
          if (selectedItem) {
            setIsDrawerOpen(false);
          } else {
            handleCreate({ title: 'Untitled Event' });
          }
        }}
        onDelete={selectedItem ? handleDelete : undefined}
        accent={accent}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <ViewProvider moduleName="calendar" defaultViewType="calendar">
      <CalendarItemsContent />
    </ViewProvider>
  );
}
