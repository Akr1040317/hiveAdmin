'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { ViewProvider, useView } from '@/contexts/ViewContext';
import { ViewToolbar } from '@/components/shared/ViewToolbar';
import { ViewTabs } from '@/components/shared/ViewTabs';
import { TableView, TableColumn } from '@/components/shared/TableView';
import { CalendarView } from '@/components/shared/CalendarView';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { CalendarItem, getCalendarItems, createCalendarItem, updateCalendarItem, deleteCalendarItem, sendCalendarItemNotification, sendCalendarItemReminder } from '@/app/actions/calendar';
import { Task, getTasks } from '@/app/actions/tasks';
import { Bug, getBugs } from '@/app/actions/bugs';
import { Feature, getFeatures } from '@/app/actions/features';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Filter, Sort } from '@/lib/views';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { getTeamMembers, supportsAssignment } from '@/lib/team-members';
import { AttendeeSelector } from '@/components/shared/AttendeeSelector';
import { Button } from '@/components/ui/Button';
import { Mail, Clock } from 'lucide-react';

type UnifiedCalendarItem = 
  | (CalendarItem & { __type: 'calendar' })
  | (Task & { __type: 'task'; dueDate: Date })
  | (Bug & { __type: 'bug'; dueDate: Date })
  | (Feature & { __type: 'feature'; dueDate: Date });

function CalendarItemsContent() {
  const { project, projectId } = useProject();
  const router = useRouter();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [newItemData, setNewItemData] = useState<Partial<CalendarItem>>({
    title: 'New Calendar Item',
    type: 'event',
    date: new Date(),
    notes: '',
    status: 'planned',
    time: '',
    attendees: [],
    reminderDays: [],
  });
  const [sendingNotification, setSendingNotification] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  const { execute: loadCalendarItems, loading: loadingCalendar } = useServerAction(getCalendarItems);
  const { execute: loadTasks, loading: loadingTasks } = useServerAction(getTasks);
  const { execute: loadBugs, loading: loadingBugs } = useServerAction(getBugs);
  const { execute: loadFeatures, loading: loadingFeatures } = useServerAction(getFeatures);
  const { execute: handleCreateItem } = useServerAction(createCalendarItem);
  const { execute: handleUpdateItem } = useServerAction(updateCalendarItem);
  const { execute: handleDeleteItem } = useServerAction(deleteCalendarItem);
  const { execute: handleSendNotification } = useServerAction(sendCalendarItemNotification);
  const { execute: handleSendReminder } = useServerAction(sendCalendarItemReminder);

  const loading = loadingCalendar || loadingTasks || loadingBugs || loadingFeatures;

  useEffect(() => {
    if (projectId) {
      Promise.all([
        loadCalendarItems(projectId).then((data) => {
          if (data) setCalendarItems(data);
        }),
        loadTasks(projectId).then((data) => {
          if (data) setTasks(data);
        }),
        loadBugs(projectId).then((data) => {
          if (data) setBugs(data);
        }),
        loadFeatures(projectId).then((data) => {
          if (data) setFeatures(data);
        }),
      ]);
    }
  }, [projectId]);

  // Combine all items with due dates for calendar view
  const allCalendarItems = useMemo(() => {
    const items: UnifiedCalendarItem[] = [];
    
    // Add calendar items
    calendarItems.forEach(item => {
      items.push({ ...item, __type: 'calendar' });
    });
    
    // Add tasks with due dates
    tasks.forEach(task => {
      if (task.dueDate) {
        items.push({ ...task, __type: 'task', dueDate: new Date(task.dueDate) });
      }
    });
    
    // Add bugs with due dates
    bugs.forEach(bug => {
      if (bug.dueDate) {
        items.push({ ...bug, __type: 'bug', dueDate: new Date(bug.dueDate) });
      }
    });
    
    // Add features with due dates
    features.forEach(feature => {
      if (feature.dueDate) {
        items.push({ ...feature, __type: 'feature', dueDate: new Date(feature.dueDate) });
      }
    });
    
    return items;
  }, [calendarItems, tasks, bugs, features]);

  const filteredItems = useMemo(() => {
    let result = allCalendarItems;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(item => {
        const title = item.__type === 'calendar' ? item.title : item.title;
        const notes = item.__type === 'calendar' ? item.notes : '';
        return title.toLowerCase().includes(searchLower) || 
               (notes && notes.toLowerCase().includes(searchLower));
      });
    }
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(item => (item as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(item => (item as any)[filter.field] !== filter.value);
      }
    });
    return result;
  }, [allCalendarItems, search, filters]);

  const handleCreate = async (data: Partial<CalendarItem>) => {
    if (!projectId) return;
    const newItem: Omit<CalendarItem, 'id' | 'createdAt' | 'updatedAt'> = {
      title: data.title || 'Untitled Event',
      type: data.type || 'event',
      date: data.date || new Date(),
      notes: data.notes || '',
      status: data.status || 'planned',
      time: data.time || '',
      attendees: data.attendees || [],
      reminderDays: data.reminderDays || [],
    };
    await handleCreateItem(projectId, newItem);
    const updated = await loadCalendarItems(projectId);
    if (updated) setCalendarItems(updated);
    setIsDrawerOpen(false);
    setNewItemData({
      title: 'New Calendar Item',
      type: 'event',
      date: new Date(),
      notes: '',
      status: 'planned',
      time: '',
      attendees: [],
      reminderDays: [],
    });
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
            <p className="text-sm text-gray-400">Important dates, deadlines, and milestones from tasks, bugs, features, and calendar items</p>
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
          setNewItemData({
            title: 'New Calendar Item',
            type: 'event',
            date: new Date(),
            notes: '',
            status: 'planned',
            time: '',
            attendees: [],
            reminderDays: [],
          });
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
            getDate={(item) => {
              if (item.__type === 'calendar') {
                return new Date(item.date);
              } else {
                return item.dueDate;
              }
            }}
            getTitle={(item) => {
              if (item.__type === 'calendar') {
                return item.title;
              } else {
                const typeLabel = item.__type === 'task' ? '[Task]' : item.__type === 'bug' ? '[Bug]' : '[Feature]';
                return `${typeLabel} ${item.title}`;
              }
            }}
            getStatus={(item) => {
              if (item.__type === 'calendar') {
                return item.status;
              } else if (item.__type === 'task') {
                return item.status;
              } else if (item.__type === 'bug') {
                return item.status;
              } else {
                return item.status;
              }
            }}
            getColor={(item) => {
              if (item.__type === 'calendar') {
                return getTypeColor(item.type);
              } else if (item.__type === 'task') {
                if (item.priority === 'high') return '#ef4444'; // red
                if (item.priority === 'medium') return '#f97316'; // orange
                return '#22c55e'; // green
              } else if (item.__type === 'bug') {
                if (item.severity === 'critical') return '#ef4444'; // red
                if (item.severity === 'high') return '#f97316'; // orange
                if (item.severity === 'medium') return '#eab308'; // yellow
                return '#22c55e'; // green
              } else {
                // feature
                if (item.priority === 'high') return '#ef4444'; // red
                if (item.priority === 'medium') return '#f97316'; // orange
                return '#22c55e'; // green
              }
            }}
            onItemClick={(item) => {
              if (item.__type === 'calendar') {
                setSelectedItem(item);
                setIsDrawerOpen(true);
              } else {
                // Navigate to the appropriate page
                if (item.__type === 'task') {
                  router.push(`/admin/${projectId}/tasks`);
                } else if (item.__type === 'bug') {
                  router.push(`/admin/${projectId}/bugs`);
                } else if (item.__type === 'feature') {
                  router.push(`/admin/${projectId}/features`);
                }
              }
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
              setNewItemData({
                title: 'New Calendar Item',
                type: 'event',
                date: new Date(),
                notes: '',
                status: 'planned',
                time: '',
                attendees: [],
                reminderDays: [],
              });
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
          setNewItemData({
            title: 'New Calendar Item',
            type: 'event',
            date: new Date(),
            notes: '',
            status: 'planned',
            time: '',
            attendees: [],
            reminderDays: [],
          });
        }}
        title={selectedItem?.title || newItemData.title || 'New Calendar Item'}
        onTitleChange={(title) => {
          if (selectedItem) {
            handleUpdate({ title });
          } else {
            setNewItemData(prev => ({ ...prev, title }));
          }
        }}
        properties={[
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            value: selectedItem?.type || newItemData.type || 'event',
            options: typeOptions,
            onChange: (value) => {
              if (selectedItem) {
                handleUpdate({ type: value as CalendarItem['type'] });
              } else {
                setNewItemData(prev => ({ ...prev, type: value as CalendarItem['type'] }));
              }
            },
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: selectedItem?.status || newItemData.status || 'planned',
            options: statusOptions,
            onChange: (value) => {
              if (selectedItem) {
                handleUpdate({ status: value as CalendarItem['status'] });
              } else {
                setNewItemData(prev => ({ ...prev, status: value as CalendarItem['status'] }));
              }
            },
          },
          {
            key: 'date',
            label: 'Date',
            type: 'date',
            value: selectedItem?.date 
              ? format(new Date(selectedItem.date), 'yyyy-MM-dd') 
              : newItemData.date 
                ? format(new Date(newItemData.date), 'yyyy-MM-dd')
                : format(new Date(), 'yyyy-MM-dd'),
            onChange: (value) => {
              if (selectedItem) {
                handleUpdate({ date: value ? new Date(value) : new Date() });
              } else {
                setNewItemData(prev => ({ ...prev, date: value ? new Date(value) : new Date() }));
              }
            },
          },
        ]}
        bodyFields={[
          {
            key: 'time',
            label: 'Time (HH:mm)',
            value: selectedItem?.time || newItemData.time || '',
            onChange: (value) => {
              if (selectedItem) {
                handleUpdate({ time: value });
              } else {
                setNewItemData(prev => ({ ...prev, time: value }));
              }
            },
            placeholder: 'e.g., 14:30 (optional)',
          },
          {
            key: 'notes',
            label: 'Notes',
            value: selectedItem?.notes || newItemData.notes || '',
            onChange: (value) => {
              if (selectedItem) {
                handleUpdate({ notes: value });
              } else {
                setNewItemData(prev => ({ ...prev, notes: value }));
              }
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
            handleCreate(newItemData);
          }
        }}
        onDelete={selectedItem ? handleDelete : undefined}
        accent={accent}
        customContent={
          <div className="space-y-4 mt-4">
            {/* Attendees Section */}
            {supportsAssignment(projectId) && (
              <div className="border-t border-border-subtle pt-4">
                <AttendeeSelector
                  attendees={selectedItem?.attendees || newItemData.attendees || []}
                  teamMembers={getTeamMembers(projectId)}
                  onChange={(attendees) => {
                    if (selectedItem) {
                      handleUpdate({ attendees });
                    } else {
                      setNewItemData(prev => ({ ...prev, attendees }));
                    }
                  }}
                />
              </div>
            )}

            {/* Reminder Days Section */}
            <div className="border-t border-border-subtle pt-4">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                Reminder Days Before Event
              </label>
              <div className="flex flex-wrap gap-2">
                {[1, 3, 7].map((days) => {
                  const isSelected = (selectedItem?.reminderDays || newItemData.reminderDays || []).includes(days);
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => {
                        const currentDays = selectedItem?.reminderDays || newItemData.reminderDays || [];
                        const newDays = isSelected
                          ? currentDays.filter(d => d !== days)
                          : [...currentDays, days];
                        if (selectedItem) {
                          handleUpdate({ reminderDays: newDays });
                        } else {
                          setNewItemData(prev => ({ ...prev, reminderDays: newDays }));
                        }
                      }}
                      className={cn(
                        'px-3 py-1.5 text-xs rounded-md border transition-colors',
                        isSelected
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          : 'bg-background-card text-gray-400 border-border-subtle hover:border-gray-600'
                      )}
                    >
                      {days} {days === 1 ? 'day' : 'days'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            {selectedItem && supportsAssignment(projectId) && (
              <div className="border-t border-border-subtle pt-4 flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    if (!projectId || !selectedItem) return;
                    const attendees = selectedItem.attendees || [];
                    if (attendees.length === 0) {
                      alert('Please add attendees before sending a notification.');
                      return;
                    }
                    setSendingNotification(true);
                    try {
                      await handleSendNotification(projectId, selectedItem.id, attendees);
                      alert('Calendar item notification sent successfully!');
                    } catch (error) {
                      console.error('Failed to send notification:', error);
                      alert(`Failed to send notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setSendingNotification(false);
                    }
                  }}
                  disabled={sendingNotification || !selectedItem.attendees || selectedItem.attendees.length === 0}
                  accent={accent}
                  className="flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {sendingNotification ? 'Sending...' : 'Send Notification'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!projectId || !selectedItem) return;
                    const reminderDays = selectedItem.reminderDays || [];
                    if (reminderDays.length === 0) {
                      alert('Please select reminder days before sending a reminder.');
                      return;
                    }
                    const daysUntil = Math.min(...reminderDays);
                    setSendingReminder(true);
                    try {
                      await handleSendReminder(projectId, selectedItem.id, daysUntil);
                      alert('Calendar item reminder sent successfully!');
                      const updated = await loadCalendarItems(projectId);
                      if (updated) setCalendarItems(updated);
                    } catch (error) {
                      console.error('Failed to send reminder:', error);
                      alert(`Failed to send reminder: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setSendingReminder(false);
                    }
                  }}
                  disabled={sendingReminder || !selectedItem.reminderDays || selectedItem.reminderDays.length === 0}
                  className="flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  {sendingReminder ? 'Sending...' : 'Send Reminder'}
                </Button>
              </div>
            )}
          </div>
        }
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
