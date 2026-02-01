'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { ViewProvider, useView } from '@/contexts/ViewContext';
import { ViewToolbar } from '@/components/shared/ViewToolbar';
import { ViewTabs } from '@/components/shared/ViewTabs';
import { TableView, TableColumn } from '@/components/shared/TableView';
import { CalendarView } from '@/components/shared/CalendarView';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { Meeting, getMeetings, createMeeting, updateMeeting, deleteMeeting } from '@/app/actions/meetings';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Filter, Sort } from '@/lib/views';
import { format } from 'date-fns';

function MeetingsContent() {
  const { project, projectId } = useProject();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);

  const { execute: loadMeetings, loading } = useServerAction(getMeetings);
  const { execute: handleCreateMeeting } = useServerAction(createMeeting);
  const { execute: handleUpdateMeeting } = useServerAction(updateMeeting);
  const { execute: handleDeleteMeeting } = useServerAction(deleteMeeting);

  useEffect(() => {
    if (projectId) {
      loadMeetings(projectId).then((data) => {
        if (data) setMeetings(data);
      });
    }
  }, [projectId]);

  const filteredMeetings = useMemo(() => {
    let result = meetings;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(m => 
        m.title.toLowerCase().includes(searchLower) ||
        m.agenda.toLowerCase().includes(searchLower) ||
        m.notes.toLowerCase().includes(searchLower)
      );
    }
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(m => (m as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(m => (m as any)[filter.field] !== filter.value);
      }
    });
    return result;
  }, [meetings, search, filters]);

  const handleCreate = async (data: Partial<Meeting>) => {
    if (!projectId) return;
    const newMeeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'> = {
      title: data.title || 'Untitled Meeting',
      startsAt: data.startsAt || new Date(),
      meetingType: data.meetingType || 'internal',
      agenda: data.agenda || '',
      notes: data.notes || '',
      actionItems: data.actionItems || [],
    };
    await handleCreateMeeting(projectId, newMeeting);
    const updated = await loadMeetings(projectId);
    if (updated) setMeetings(updated);
    setIsDrawerOpen(false);
  };

  const handleUpdate = async (updates: Partial<Meeting>) => {
    if (!projectId || !selectedMeeting) return;
    await handleUpdateMeeting(projectId, selectedMeeting.id, updates);
    const updated = await loadMeetings(projectId);
    if (updated) setMeetings(updated);
    setSelectedMeeting({ ...selectedMeeting, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedMeeting) return;
    if (confirm('Are you sure?')) {
      await handleDeleteMeeting(projectId, selectedMeeting.id);
      const updated = await loadMeetings(projectId);
      if (updated) setMeetings(updated);
      setIsDrawerOpen(false);
      setSelectedMeeting(null);
    }
  };

  const availableFields = [
    { value: 'title', label: 'Title', type: 'text' as const },
    { value: 'meetingType', label: 'Type', type: 'select' as const },
    { value: 'startsAt', label: 'Date & Time', type: 'date' as const },
  ];

  const typeOptions = [
    { value: 'internal', label: 'Internal' },
    { value: 'partner', label: 'Partner' },
    { value: 'ops', label: 'Ops' },
    { value: 'review', label: 'Review' },
  ];

  const getTypeColor = (type: string): string => {
    const t = type.toLowerCase();
    if (t === 'internal') return '#3b82f6'; // blue-500
    if (t === 'partner') return '#8b5cf6'; // purple-500
    if (t === 'ops') return '#f97316'; // orange-500
    if (t === 'review') return '#22c55e'; // green-500
    return '#6b7280'; // gray-500
  };

  const tableColumns: TableColumn<Meeting>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (m) => (
        <div>
          <div className="font-semibold text-sm text-gray-50">{m.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{format(new Date(m.startsAt), 'MMM d, yyyy h:mm a')}</div>
        </div>
      ),
    },
    {
      key: 'meetingType',
      header: 'Type',
      sortable: true,
      type: 'badge',
      render: (m) => (
        <Badge className={cn('text-xs capitalize', getTypeColor(m.meetingType) === 'bg-blue-500' && 'bg-blue-500/20 text-blue-400 border-blue-500/40', getTypeColor(m.meetingType) === 'bg-purple-500' && 'bg-purple-500/20 text-purple-400 border-purple-500/40', getTypeColor(m.meetingType) === 'bg-orange-500' && 'bg-orange-500/20 text-orange-400 border-orange-500/40', getTypeColor(m.meetingType) === 'bg-green-500' && 'bg-green-500/20 text-green-400 border-green-500/40')}>
          {m.meetingType}
        </Badge>
      ),
    },
    {
      key: 'agenda',
      header: 'Agenda',
      sortable: false,
      render: (m) => (
        <div className="text-xs text-gray-400 line-clamp-2 max-w-md">
          {m.agenda || 'No agenda'}
        </div>
      ),
    },
    {
      key: 'actionItems',
      header: 'Action Items',
      sortable: false,
      render: (m) => (
        <Badge variant="secondary" className="text-xs">
          {m.actionItems?.length || 0} {m.actionItems?.length === 1 ? 'item' : 'items'}
        </Badge>
      ),
    },
  ];

  const viewType = currentView?.viewType || 'table';
  const accent = project?.accentColorKey || false;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
          <div>
            <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Meetings</h1>
            <p className="text-sm text-gray-400">Meeting agendas, notes, and action items</p>
          </div>
        </div>
      </div>

      <ViewTabs availableViewTypes={['table', 'calendar']} onViewTypeChange={switchViewType} accent={accent} />

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
          setSelectedMeeting(null);
          setIsDrawerOpen(true);
        }}
        viewType={viewType}
        accent={accent}
      />

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading meetings...</div>
        ) : viewType === 'table' ? (
          <TableView
            data={filteredMeetings}
            columns={tableColumns}
            sorts={sorts}
            onSortChange={(newSorts) => {
              setSorts(newSorts);
              updateCurrentView({ sorts: newSorts });
            }}
            visibleColumns={currentView?.visibleColumns}
            onRowClick={(m) => {
              setSelectedMeeting(m);
              setIsDrawerOpen(true);
            }}
            onQuickAdd={() => {
              setSelectedMeeting(null);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No meetings found. Create your first meeting!"
            accent={accent}
          />
        ) : (
          <CalendarView
            data={filteredMeetings}
            getDate={(m) => new Date(m.startsAt)}
            getTitle={(m) => m.title}
            getStatus={(m) => m.meetingType}
            getColor={(m) => getTypeColor(m.meetingType)}
            onItemClick={(m) => {
              setSelectedMeeting(m);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No meetings found. Create your first meeting!"
            accent={accent}
          />
        )}
      </div>

      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedMeeting(null);
        }}
        title={selectedMeeting?.title || 'New Meeting'}
        onTitleChange={(title) => {
          if (selectedMeeting) handleUpdate({ title });
        }}
        properties={[
          {
            key: 'startsAt',
            label: 'Date & Time',
            type: 'date',
            value: selectedMeeting?.startsAt ? format(new Date(selectedMeeting.startsAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            onChange: (value) => {
              if (selectedMeeting) {
                const date = new Date(value);
                const existingDate = new Date(selectedMeeting.startsAt);
                date.setHours(existingDate.getHours());
                date.setMinutes(existingDate.getMinutes());
                handleUpdate({ startsAt: date });
              }
            },
          },
          {
            key: 'meetingType',
            label: 'Type',
            type: 'select',
            value: selectedMeeting?.meetingType || 'internal',
            options: typeOptions,
            onChange: (value) => {
              if (selectedMeeting) handleUpdate({ meetingType: value as Meeting['meetingType'] });
            },
          },
        ]}
        bodyFields={[
          {
            key: 'agenda',
            label: 'Agenda',
            value: selectedMeeting?.agenda || '',
            onChange: (value) => {
              if (selectedMeeting) handleUpdate({ agenda: value });
            },
            placeholder: 'Meeting agenda...',
          },
          {
            key: 'notes',
            label: 'Notes',
            value: selectedMeeting?.notes || '',
            onChange: (value) => {
              if (selectedMeeting) handleUpdate({ notes: value });
            },
            placeholder: 'Meeting notes...',
          },
        ]}
        metadata={selectedMeeting ? {
          createdAt: selectedMeeting.createdAt,
          updatedAt: selectedMeeting.updatedAt,
        } : undefined}
        onSave={() => {
          if (selectedMeeting) {
            setIsDrawerOpen(false);
          } else {
            handleCreate({ title: 'Untitled Meeting' });
          }
        }}
        onDelete={selectedMeeting ? handleDelete : undefined}
        accent={accent}
      />
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <ViewProvider moduleName="meetings" defaultViewType="table">
      <MeetingsContent />
    </ViewProvider>
  );
}
