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
import { Task, getTasks, createTask, updateTask, deleteTask } from '@/app/actions/tasks';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Filter, Sort } from '@/lib/views';
import { format } from 'date-fns';
import { getTeamMembers, supportsAssignment } from '@/lib/team-members';

function TasksContent() {
  const { project, projectId } = useProject();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [newTaskData, setNewTaskData] = useState<Partial<Task>>({
    title: 'New Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: undefined,
    completionDate: undefined,
    assignedTo: undefined,
    notes: undefined,
  });

  const { execute: loadTasks, loading } = useServerAction(getTasks);
  const { execute: handleCreateTask } = useServerAction(createTask);
  const { execute: handleUpdateTask } = useServerAction(updateTask);
  const { execute: handleDeleteTask } = useServerAction(deleteTask);

  useEffect(() => {
    if (projectId) {
      loadTasks(projectId).then((data) => {
        if (data) setTasks(data);
      });
    }
  }, [projectId]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply filters
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(task => (task as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(task => (task as any)[filter.field] !== filter.value);
      } else if (filter.operator === 'contains') {
        result = result.filter(task => {
          const val = String((task as any)[filter.field] || '').toLowerCase();
          return val.includes(String(filter.value).toLowerCase());
        });
      }
    });

    return result;
  }, [tasks, search, filters]);

  const handleCreate = async (data: Partial<Task>) => {
    if (!projectId) return;
    console.log('[Task Create] Creating new task:', {
      projectId,
      data,
      hasAssignee: !!data.assignedTo,
      assignee: data.assignedTo,
    });
    
    const newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
      title: data.title || 'Untitled Task',
      description: data.description || '',
      priority: data.priority || 'medium',
      status: data.status || 'todo',
      order: tasks.length,
      dueDate: data.dueDate,
      completionDate: data.completionDate,
      assignedTo: data.assignedTo,
      notes: data.notes,
      tags: data.tags,
    };
    
    try {
      const taskId = await handleCreateTask(projectId, newTask);
      console.log('[Task Create] Task created successfully:', taskId);
      
      const updated = await loadTasks(projectId);
      if (updated) setTasks(updated);
      setIsDrawerOpen(false);
      setNewTaskData({
        title: 'New Task',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: undefined,
        completionDate: undefined,
        assignedTo: undefined,
        notes: undefined,
      });
    } catch (error) {
      console.error('[Task Create] Failed to create task:', error);
      throw error;
    }
  };

  const handleUpdate = async (updates: Partial<Task>) => {
    if (!projectId || !selectedTask) return;
    console.log('[Task Update] Updating task:', {
      taskId: selectedTask.id,
      updates,
    });
    await handleUpdateTask(projectId, selectedTask.id, updates);
    const updated = await loadTasks(projectId);
    if (updated) setTasks(updated);
    setSelectedTask({ ...selectedTask, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedTask) return;
    if (confirm('Are you sure you want to delete this task?')) {
      await handleDeleteTask(projectId, selectedTask.id);
      const updated = await loadTasks(projectId);
      if (updated) setTasks(updated);
      setIsDrawerOpen(false);
      setSelectedTask(null);
    }
  };

  const handleCardMove = async (taskId: string, newStatus: string) => {
    const status = newStatus as Task['status'];
    if (!projectId) {
      console.warn('No projectId, cannot move card');
      return;
    }
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      console.error('Task not found:', taskId);
      return;
    }
    
    // Don't update if status hasn't changed
    if (task.status === newStatus) {
      console.log('Status unchanged, skipping update');
      return;
    }
    
    console.log('Moving task:', taskId, 'from', task.status, 'to', newStatus);
    
    // Optimistically update the UI immediately
    const previousTasks = [...tasks];
    setTasks(prevTasks => 
      prevTasks.map(t =>
        t.id === taskId ? { ...t, status } : t
      )
    );
    
    try {
      const result = await handleUpdateTask(projectId, taskId, { status: newStatus });
      console.log('Task status updated successfully:', result);
      
      // Reload to ensure consistency with server
      const updated = await loadTasks(projectId);
      if (updated) {
        setTasks(updated);
        console.log('Tasks reloaded from server');
      } else {
        // If reload failed, keep optimistic update
        console.warn('Failed to reload tasks, keeping optimistic update');
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
      // Revert optimistic update on error
      setTasks(previousTasks);
      
      // Try to reload to get current state
      try {
        const updated = await loadTasks(projectId);
        if (updated) setTasks(updated);
      } catch (reloadError) {
        console.error('Failed to reload tasks:', reloadError);
      }
      
      // Show user-friendly error
      alert(`Failed to move task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRefresh = async () => {
    if (!projectId) return;
    const updated = await loadTasks(projectId);
    if (updated) setTasks(updated);
  };

  const availableFields = [
    { value: 'title', label: 'Title', type: 'text' as const },
    { value: 'status', label: 'Status', type: 'select' as const },
    { value: 'priority', label: 'Priority', type: 'select' as const },
    { value: 'updatedAt', label: 'Updated', type: 'date' as const },
    { value: 'createdBy', label: 'Created By', type: 'text' as const },
  ];

  const statusOptions = [
    { value: 'todo', label: 'Todo' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'completed', label: 'Completed' },
  ];

  const priorityOptions = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const tableColumns: TableColumn<Task>[] = [
    {
      key: 'status',
      header: 'STATUS',
      sortable: true,
      type: 'select',
      options: statusOptions,
      onEdit: (task, value) => handleCardMove(task.id, value as Task['status']),
      render: (task) => {
        const statusLabels: Record<string, string> = {
          todo: 'Todo',
          in_progress: 'In Progress',
          blocked: 'Blocked',
          completed: 'Completed',
        };
        const statusColors: Record<string, string> = {
          todo: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
          in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
          blocked: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
          completed: 'bg-green-500/20 text-green-400 border-green-500/40',
        };
        return (
          <Badge className={cn('text-xs', statusColors[task.status] || statusColors.todo)}>
            {statusLabels[task.status] || task.status}
          </Badge>
        );
      },
    },
    {
      key: 'title',
      header: 'TITLE',
      sortable: true,
      render: (task) => (
        <div>
          <div className="font-medium text-sm text-gray-50">{task.title || 'No title'}</div>
          <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{task.description}</div>
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'PRIORITY',
      sortable: true,
      type: 'badge',
      render: (task) => {
        const colors: Record<string, string> = {
          high: 'bg-red-500/20 text-red-400 border-red-500/40',
          medium: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
          low: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
        };
        const labels: Record<string, string> = {
          high: 'High',
          medium: 'Medium',
          low: 'Low',
        };
        return (
          <Badge className={cn('text-xs capitalize', colors[task.priority])}>
            {labels[task.priority] || task.priority}
          </Badge>
        );
      },
    },
    ...(projectId && supportsAssignment(projectId) ? [{
      key: 'assignedTo',
      header: 'ASSIGNED TO',
      sortable: true,
      render: (task: Task) => (
        <span className="text-xs text-gray-400">
          {task.assignedTo ? task.assignedTo.split('@')[0] : 'Unassigned'}
        </span>
      ),
    }] : []),
    {
      key: 'dueDate',
      header: 'DUE DATE',
      sortable: false,
      render: (task) => (
        <span className="text-xs text-gray-400">
          {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'completionDate',
      header: 'COMPLETION DATE',
      sortable: false,
      render: (task) => (
        <span className="text-xs text-gray-400">
          {task.completionDate ? format(new Date(task.completionDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'CREATED',
      sortable: true,
      type: 'date',
      render: (task) => (
        <span className="text-xs text-gray-400">
          {format(new Date(task.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      sortable: false,
      render: (task) => (
        <Button
          size="sm"
          variant="primary"
          accent={accent}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedTask(task);
            setIsDrawerOpen(true);
          }}
          className="h-7 text-xs px-3"
        >
          View
        </Button>
      ),
    },
  ];

  const boardColumns = [
    { id: 'todo', title: 'TODO', status: 'todo' },
    { id: 'in_progress', title: 'IN PROGRESS', status: 'in_progress' },
    { id: 'blocked', title: 'BLOCKED', status: 'blocked' },
    { id: 'completed', title: 'COMPLETED', status: 'completed' },
  ];

  const viewType = currentView?.viewType || 'table';
  const accent = project?.accentColorKey || false;

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
            <div>
              <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>
                TASKS MANAGEMENT
              </h1>
              <p className="text-sm text-gray-400">
                Track and manage general tasks
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 px-3"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <ViewTabs
        availableViewTypes={['table', 'board', 'calendar']}
        onViewTypeChange={(vt) => {
          if (vt !== 'tracker') {
            switchViewType(vt);
          }
        }}
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
          setSelectedTask(null);
          setNewTaskData({
            title: 'New Task',
            description: '',
            status: 'todo',
            priority: 'medium',
            dueDate: undefined,
            completionDate: undefined,
            assignedTo: undefined,
            notes: undefined,
          });
          setIsDrawerOpen(true);
        }}
        viewType={viewType}
        accent={accent}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading tasks...</div>
        ) : viewType === 'table' ? (
          <TableView
            data={filteredTasks}
            columns={tableColumns}
            sorts={sorts}
            onSortChange={(newSorts) => {
              setSorts(newSorts);
              updateCurrentView({ sorts: newSorts });
            }}
            visibleColumns={currentView?.visibleColumns}
            onRowClick={(task) => {
              setSelectedTask(task);
              setIsDrawerOpen(true);
            }}
            onQuickAdd={() => {
              setSelectedTask(null);
              setNewTaskData({
                title: 'New Task',
                description: '',
                status: 'todo',
                priority: 'medium',
                dueDate: undefined,
                completionDate: undefined,
                assignedTo: undefined,
                notes: undefined,
              });
              setIsDrawerOpen(true);
            }}
            emptyMessage="No tasks found. Create your first task!"
            accent={accent}
          />
        ) : viewType === 'board' ? (
          <BoardView
            data={filteredTasks}
            columns={boardColumns}
            getCardData={(task) => ({
              title: task.title,
              subtitle: task.description ? task.description.substring(0, 60) + (task.description.length > 60 ? '...' : '') : undefined,
              badges: [
                { 
                  label: task.priority.charAt(0).toUpperCase() + task.priority.slice(1), 
                  variant: task.priority as 'high' | 'medium' | 'low'
                },
              ],
              updatedAt: new Date(task.updatedAt),
              userId: task.createdBy?.split('@')[0] || 'user',
            })}
            onCardClick={(task) => {
              setSelectedTask(task);
              setIsDrawerOpen(true);
            }}
            onCardMove={handleCardMove}
            onAddCard={(status) => {
              setSelectedTask(null);
              setNewTaskData({
                title: 'New Task',
                description: '',
                status: status as Task['status'],
                priority: 'medium',
                dueDate: undefined,
                completionDate: undefined,
                assignedTo: undefined,
                notes: undefined,
              });
              setIsDrawerOpen(true);
            }}
            emptyMessage="No tasks found. Create your first task!"
            accent={accent}
          />
        ) : (
          <CalendarView
            data={filteredTasks}
            getDate={(task) => task.dueDate ? new Date(task.dueDate) : (task.updatedAt ? new Date(task.updatedAt) : new Date(task.createdAt))}
            getTitle={(task) => task.title}
            getStatus={(task) => task.status}
            getColor={(task) => {
              if (task.priority === 'high') return '#ef4444'; // red
              if (task.priority === 'medium') return '#f97316'; // orange
              return '#22c55e'; // green for low
            }}
            onItemClick={(task) => {
              setSelectedTask(task);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No tasks found. Create your first task!"
            accent={accent}
          />
        )}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedTask(null);
          setNewTaskData({
            title: 'New Task',
            description: '',
            status: 'todo',
            priority: 'medium',
            dueDate: undefined,
            completionDate: undefined,
            assignedTo: undefined,
            notes: undefined,
          });
        }}
        title={selectedTask?.title || newTaskData.title || 'New Task'}
        onTitleChange={(title) => {
          if (selectedTask) {
            handleUpdate({ title });
          } else {
            setNewTaskData(prev => ({ ...prev, title }));
          }
        }}
        properties={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: selectedTask?.status || newTaskData.status || 'todo',
            options: statusOptions,
            onChange: (value) => {
              if (selectedTask) {
                handleUpdate({ status: value as Task['status'] });
              } else {
                setNewTaskData(prev => ({ ...prev, status: value as Task['status'] }));
              }
            },
          },
          {
            key: 'priority',
            label: 'Priority',
            type: 'select',
            value: selectedTask?.priority || newTaskData.priority || 'medium',
            options: priorityOptions,
            onChange: (value) => {
              if (selectedTask) {
                handleUpdate({ priority: value as Task['priority'] });
              } else {
                setNewTaskData(prev => ({ ...prev, priority: value as Task['priority'] }));
              }
            },
          },
          {
            key: 'dueDate',
            label: 'Due Date',
            type: 'date',
            value: selectedTask?.dueDate || newTaskData.dueDate,
            onChange: (value) => {
              if (selectedTask) {
                handleUpdate({ dueDate: value });
              } else {
                setNewTaskData(prev => ({ ...prev, dueDate: value }));
              }
            },
          },
          {
            key: 'completionDate',
            label: 'Completion Date',
            type: 'date',
            value: selectedTask?.completionDate || newTaskData.completionDate,
            onChange: (value) => {
              if (selectedTask) {
                handleUpdate({ completionDate: value });
              } else {
                setNewTaskData(prev => ({ ...prev, completionDate: value }));
              }
            },
          },
        ]}
        bodyFields={[
          {
            key: 'description',
            label: 'Description',
            value: selectedTask?.description || newTaskData.description || '',
            onChange: (value) => {
              if (selectedTask) {
                handleUpdate({ description: value });
              } else {
                setNewTaskData(prev => ({ ...prev, description: value }));
              }
            },
            placeholder: 'Describe the task...',
          },
          {
            key: 'notes',
            label: 'Notes',
            value: selectedTask?.notes || newTaskData.notes || '',
            onChange: (value: string) => {
              if (selectedTask) {
                handleUpdate({ notes: value });
              } else {
                setNewTaskData(prev => ({ ...prev, notes: value }));
              }
            },
            placeholder: 'Add notes about this task...',
          },
        ]}
        metadata={selectedTask ? {
          createdAt: selectedTask.createdAt,
          updatedAt: selectedTask.updatedAt,
          createdBy: selectedTask.createdBy,
        } : undefined}
        onSave={() => {
          if (selectedTask) {
            setIsDrawerOpen(false);
          } else {
            handleCreate(newTaskData);
          }
        }}
        onDelete={selectedTask ? handleDelete : undefined}
        assignedTo={selectedTask?.assignedTo || newTaskData.assignedTo || null}
        teamMembers={projectId && supportsAssignment(projectId) ? getTeamMembers(projectId) : []}
        onAssignedToChange={(email) => {
          if (selectedTask) {
            handleUpdate({ assignedTo: email || undefined });
          } else {
            setNewTaskData(prev => ({ ...prev, assignedTo: email || undefined }));
          }
        }}
        showAssignment={projectId ? supportsAssignment(projectId) : false}
        accent={accent}
      />
    </div>
  );
}

export default function TasksPage() {
  const { projectId } = useProject();
  
  return (
    <ViewProvider moduleName="tasks" defaultViewType="board">
      <TasksContent />
    </ViewProvider>
  );
}
