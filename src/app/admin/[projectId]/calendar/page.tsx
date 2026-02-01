'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, Column } from '@/components/shared/DataTable';
import { CalendarItem, getCalendarItems, createCalendarItem, updateCalendarItem, deleteCalendarItem } from '@/app/actions/calendar';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export default function CalendarPage() {
  const { project, projectId } = useProject();
  const accentClasses = project?.accentClasses;
  
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

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

  const [formData, setFormData] = useState({
    title: '',
    type: 'event' as CalendarItem['type'],
    date: '',
    notes: '',
    status: 'planned' as CalendarItem['status'],
  });

  useEffect(() => {
    if (selectedItem) {
      setFormData({
        title: selectedItem.title,
        type: selectedItem.type,
        date: new Date(selectedItem.date).toISOString().split('T')[0],
        notes: selectedItem.notes || '',
        status: selectedItem.status,
      });
    } else {
      setFormData({
        title: '',
        type: 'event',
        date: '',
        notes: '',
        status: 'planned',
      });
    }
  }, [selectedItem, isFormOpen]);

  const handleCreate = async (data: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!projectId) return;
    await handleCreateItem(projectId, {
      ...data,
      date: new Date(data.date),
    });
    const updated = await loadCalendarItems(projectId);
    if (updated) setCalendarItems(updated);
  };

  const handleUpdate = async (data: Partial<Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>>) => {
    if (!projectId || !selectedItem) return;
    await handleUpdateItem(projectId, selectedItem.id, {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
    });
    const updated = await loadCalendarItems(projectId);
    if (updated) setCalendarItems(updated);
    setSelectedItem(null);
  };

  const filteredItems = calendarItems.filter((item) => {
    if (typeFilter && item.type !== typeFilter) return false;
    if (statusFilter && item.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<CalendarItem>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (item) => (
        <div>
          <div className="font-medium">{item.title}</div>
          {item.notes && (
            <div className="text-sm text-gray-400 line-clamp-1">{item.notes}</div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item) => (
        <Badge variant="default" className="capitalize">
          {item.type}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (item) => (
        <span className="text-sm text-gray-300">
          {new Date(item.date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Select
          value={item.status}
          onChange={(e) => {
            if (projectId) {
              handleUpdateItem(projectId, item.id, { status: e.target.value as CalendarItem['status'] }).then(() => {
                loadCalendarItems(projectId).then((data) => {
                  if (data) setCalendarItems(data);
                });
              });
            }
          }}
          accent
          className="w-40"
        >
          <option value="planned">Planned</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
        </Select>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItem(item);
              setIsFormOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this calendar item?')) {
                handleDeleteItem(projectId!, item.id).then(() => {
                  loadCalendarItems(projectId!).then((data) => {
                    if (data) setCalendarItems(data);
                  });
                });
              }
            }}
            className="text-red-400 hover:text-red-300"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className={cn('text-3xl font-bold mb-2', accentClasses?.text)}>
            Calendar
          </h1>
          <div className={cn('h-1 w-24 rounded', accentClasses?.bg)} />
          <p className="text-gray-400 mt-4">
            Important dates, deadlines, milestones, and events
          </p>
        </div>
        <Button variant="primary" accent onClick={() => {
          setSelectedItem(null);
          setIsFormOpen(true);
        }}>
          New Calendar Item
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading calendar items...</div>
          ) : (
            <DataTable
              data={filteredItems}
              columns={columns}
              searchKey="title"
              searchPlaceholder="Search calendar items..."
              filters={[
                {
                  key: 'type',
                  label: 'Type',
                  options: [
                    { value: 'deadline', label: 'Deadline' },
                    { value: 'milestone', label: 'Milestone' },
                    { value: 'event', label: 'Event' },
                    { value: 'reminder', label: 'Reminder' },
                  ],
                  value: typeFilter,
                  onChange: setTypeFilter,
                },
                {
                  key: 'status',
                  label: 'Status',
                  options: [
                    { value: 'planned', label: 'Planned' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'completed', label: 'Completed' },
                  ],
                  value: statusFilter,
                  onChange: setStatusFilter,
                },
              ]}
              emptyMessage="No calendar items found. Add your first item!"
              accent
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedItem(null);
        }}
        title={selectedItem ? 'Edit Calendar Item' : 'Create Calendar Item'}
        accent
        size="lg"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (selectedItem) {
              await handleUpdate(formData);
            } else {
              await handleCreate(formData as Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'>);
            }
            setIsFormOpen(false);
            setSelectedItem(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required accent />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
              <Select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as CalendarItem['type'] })} accent>
                <option value="deadline">Deadline</option>
                <option value="milestone">Milestone</option>
                <option value="event">Event</option>
                <option value="reminder">Reminder</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
              <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required accent />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <Select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as CalendarItem['status'] })} accent>
              <option value="planned">Planned</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-violet-500/40 focus:border-violet-500/30"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsFormOpen(false); setSelectedItem(null); }}>Cancel</Button>
            <Button type="submit" variant="primary" accent>{selectedItem ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
