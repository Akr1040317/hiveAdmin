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
import { Feature, getFeatures, createFeature, updateFeature, deleteFeature } from '@/app/actions/features';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Filter, Sort } from '@/lib/views';
import { format } from 'date-fns';
import { getTeamMembers, supportsAssignment } from '@/lib/team-members';

function FeaturesContent() {
  const { project, projectId } = useProject();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [newFeatureData, setNewFeatureData] = useState<Partial<Feature>>({
    title: 'New Feature',
    description: '',
    status: 'idea',
    priority: 'medium',
    area: 'learner',
    dueDate: undefined,
    completionDate: undefined,
    assignedTo: undefined,
  });

  const { execute: loadFeatures, loading } = useServerAction(getFeatures);
  const { execute: handleCreateFeature } = useServerAction(createFeature);
  const { execute: handleUpdateFeature } = useServerAction(updateFeature);
  const { execute: handleDeleteFeature } = useServerAction(deleteFeature);

  useEffect(() => {
    if (projectId) {
      loadFeatures(projectId).then((data) => {
        if (data) setFeatures(data);
      });
    }
  }, [projectId]);

  const filteredFeatures = useMemo(() => {
    let result = features;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(f => f.title.toLowerCase().includes(searchLower) || f.description.toLowerCase().includes(searchLower));
    }
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(f => (f as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(f => (f as any)[filter.field] !== filter.value);
      }
    });
    return result;
  }, [features, search, filters]);

  const handleCreate = async (data: Partial<Feature>) => {
    if (!projectId) return;
    console.log('[Feature Create] Creating new feature:', {
      projectId,
      data,
      hasAssignee: !!data.assignedTo,
      assignee: data.assignedTo,
    });
    
    const newFeature: Omit<Feature, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
      title: data.title || 'Untitled Feature',
      description: data.description || '',
      area: data.area || 'learner',
      priority: data.priority || 'medium',
      status: data.status || 'idea',
      order: features.length,
      dueDate: data.dueDate,
      completionDate: data.completionDate,
      assignedTo: data.assignedTo,
    };
    
    try {
      const featureId = await handleCreateFeature(projectId, newFeature);
      console.log('[Feature Create] Feature created successfully:', featureId);
      
      const updated = await loadFeatures(projectId);
      if (updated) setFeatures(updated);
      setIsDrawerOpen(false);
      setNewFeatureData({
        title: 'New Feature',
        description: '',
        status: 'idea',
        priority: 'medium',
        area: 'learner',
        dueDate: undefined,
        completionDate: undefined,
        assignedTo: undefined,
      });
    } catch (error) {
      console.error('[Feature Create] Failed to create feature:', error);
      throw error;
    }
  };

  const handleUpdate = async (updates: Partial<Feature>) => {
    if (!projectId || !selectedFeature) return;
    console.log('[Feature Update] Updating feature:', {
      featureId: selectedFeature.id,
      updates,
    });
    await handleUpdateFeature(projectId, selectedFeature.id, updates);
    const updated = await loadFeatures(projectId);
    if (updated) setFeatures(updated);
    setSelectedFeature({ ...selectedFeature, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedFeature) return;
    if (confirm('Are you sure?')) {
      await handleDeleteFeature(projectId, selectedFeature.id);
      const updated = await loadFeatures(projectId);
      if (updated) setFeatures(updated);
      setIsDrawerOpen(false);
      setSelectedFeature(null);
    }
  };

  const handleCardMove = async (featureId: string, newStatus: string) => {
    if (!projectId) return;
    const status = newStatus as Feature['status'];
    await handleUpdateFeature(projectId, featureId, { status });
    const updated = await loadFeatures(projectId);
    if (updated) setFeatures(updated);
  };

  const availableFields = [
    { value: 'title', label: 'Title', type: 'text' as const },
    { value: 'status', label: 'Status', type: 'select' as const },
    { value: 'priority', label: 'Priority', type: 'select' as const },
    { value: 'area', label: 'Feature Area', type: 'select' as const },
    { value: 'updatedAt', label: 'Updated', type: 'date' as const },
  ];

  const statusOptions = [
    { value: 'idea', label: 'Idea' },
    { value: 'planned', label: 'Planned' },
    { value: 'in_development', label: 'In Development' },
    { value: 'released', label: 'Released' },
  ];

  const priorityOptions = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const areaOptions = [
    { value: 'learner', label: 'Learner' },
    { value: 'admin', label: 'Admin' },
    { value: 'content', label: 'Content' },
    { value: 'ops', label: 'Ops' },
  ];

  const tableColumns: TableColumn<Feature>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (f) => (
        <div>
          <div className="font-medium text-sm text-gray-50">{f.title}</div>
          <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{f.description}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      type: 'select',
      options: statusOptions,
      onEdit: (f, value) => handleCardMove(f.id, value as Feature['status']),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      type: 'badge',
      render: (f) => {
        const colors: Record<string, string> = {
          high: 'bg-red-500/20 text-red-400 border-red-500/40',
          medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
          low: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
        };
        return <Badge className={cn('text-xs capitalize', colors[f.priority])}>{f.priority}</Badge>;
      },
    },
    ...(projectId && supportsAssignment(projectId) ? [{
      key: 'assignedTo',
      header: 'ASSIGNED TO',
      sortable: true,
      render: (f: Feature) => (
        <span className="text-xs text-gray-400">
          {f.assignedTo ? f.assignedTo.split('@')[0] : 'Unassigned'}
        </span>
      ),
    }] : []),
    {
      key: 'area',
      header: 'Feature Area',
      sortable: true,
      type: 'badge',
      render: (f) => <Badge variant="secondary" className="text-xs capitalize">{f.area}</Badge>,
    },
    {
      key: 'dueDate',
      header: 'DUE DATE',
      sortable: false,
      render: (f) => (
        <span className="text-xs text-gray-400">
          {f.dueDate ? format(new Date(f.dueDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      type: 'date',
      render: (f) => <span className="text-xs text-gray-400">{format(new Date(f.updatedAt), 'MMM d, yyyy')}</span>,
    },
  ];

  const boardColumns = [
    { id: 'idea', title: 'Idea', status: 'idea' },
    { id: 'planned', title: 'Planned', status: 'planned' },
    { id: 'in_development', title: 'In Development', status: 'in_development' },
    { id: 'released', title: 'Released', status: 'released' },
  ];

  const viewType = currentView?.viewType || 'table';
  const accent = project?.accentColorKey || false;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
          <div>
            <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Features</h1>
            <p className="text-sm text-gray-400">Manage feature requests and development</p>
          </div>
        </div>
      </div>

      <ViewTabs availableViewTypes={['table', 'board', 'calendar']} onViewTypeChange={(vt) => {
        if (vt !== 'tracker') {
          switchViewType(vt);
        }
      }} accent={accent} />

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
          setSelectedFeature(null);
          setNewFeatureData({
            title: 'New Feature',
            description: '',
            status: 'idea',
            priority: 'medium',
            area: 'learner',
            dueDate: undefined,
            completionDate: undefined,
            assignedTo: undefined,
          });
          setIsDrawerOpen(true);
        }}
        viewType={viewType}
        accent={accent}
      />

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading features...</div>
        ) : viewType === 'table' ? (
          <TableView
            data={filteredFeatures}
            columns={tableColumns}
            sorts={sorts}
            onSortChange={(newSorts) => {
              setSorts(newSorts);
              updateCurrentView({ sorts: newSorts });
            }}
            visibleColumns={currentView?.visibleColumns}
            onRowClick={(f) => {
              setSelectedFeature(f);
              setIsDrawerOpen(true);
            }}
            onQuickAdd={() => {
              setSelectedFeature(null);
              setNewFeatureData({
                title: 'New Feature',
                description: '',
                status: 'idea',
                priority: 'medium',
                area: 'learner',
                dueDate: undefined,
                completionDate: undefined,
                assignedTo: undefined,
              });
              setIsDrawerOpen(true);
            }}
            emptyMessage="No features found. Create your first feature!"
            accent={accent}
          />
        ) : viewType === 'board' ? (
          <BoardView
            data={filteredFeatures}
            columns={boardColumns}
            getCardData={(f) => ({
              title: f.title,
              subtitle: f.description ? f.description.substring(0, 60) + (f.description.length > 60 ? '...' : '') : f.area,
              badges: [
                { 
                  label: f.priority.charAt(0).toUpperCase() + f.priority.slice(1), 
                  variant: f.priority as 'high' | 'medium' | 'low'
                },
                { 
                  label: f.area.charAt(0).toUpperCase() + f.area.slice(1), 
                  variant: 'secondary' 
                },
              ],
              updatedAt: f.updatedAt,
              userId: f.createdBy?.split('@')[0] || 'user',
            })}
            onCardClick={(f) => {
              setSelectedFeature(f);
              setIsDrawerOpen(true);
            }}
            onCardMove={handleCardMove}
            onAddCard={(status) => {
              setSelectedFeature(null);
              setNewFeatureData({
                title: 'New Feature',
                description: '',
                status: status as Feature['status'],
                priority: 'medium',
                area: 'learner',
                dueDate: undefined,
                completionDate: undefined,
                assignedTo: undefined,
              });
              setIsDrawerOpen(true);
            }}
            emptyMessage="No features found. Create your first feature!"
            accent={accent}
          />
        ) : (
          <CalendarView
            data={filteredFeatures}
            getDate={(f) => f.dueDate ? new Date(f.dueDate) : (f.updatedAt ? new Date(f.updatedAt) : new Date(f.createdAt))}
            getTitle={(f) => f.title}
            getStatus={(f) => f.status}
            getColor={(f) => {
              if (f.priority === 'high') return '#ef4444'; // red
              if (f.priority === 'medium') return '#f97316'; // orange
              return '#22c55e'; // green for low
            }}
            onItemClick={(f) => {
              setSelectedFeature(f);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No features found. Create your first feature!"
            accent={accent}
          />
        )}
      </div>

      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedFeature(null);
          setNewFeatureData({
            title: 'New Feature',
            description: '',
            status: 'idea',
            priority: 'medium',
            area: 'learner',
            dueDate: undefined,
            completionDate: undefined,
            assignedTo: undefined,
          });
        }}
        title={selectedFeature?.title || newFeatureData.title || 'New Feature'}
        onTitleChange={(title) => {
          if (selectedFeature) {
            handleUpdate({ title });
          } else {
            setNewFeatureData(prev => ({ ...prev, title }));
          }
        }}
        properties={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: selectedFeature?.status || newFeatureData.status || 'idea',
            options: statusOptions,
            onChange: (value) => {
              if (selectedFeature) {
                handleUpdate({ status: value as Feature['status'] });
              } else {
                setNewFeatureData(prev => ({ ...prev, status: value as Feature['status'] }));
              }
            },
          },
          {
            key: 'priority',
            label: 'Priority',
            type: 'select',
            value: selectedFeature?.priority || newFeatureData.priority || 'medium',
            options: priorityOptions,
            onChange: (value) => {
              if (selectedFeature) {
                handleUpdate({ priority: value as Feature['priority'] });
              } else {
                setNewFeatureData(prev => ({ ...prev, priority: value as Feature['priority'] }));
              }
            },
          },
          {
            key: 'area',
            label: 'Feature Area',
            type: 'select',
            value: selectedFeature?.area || newFeatureData.area || 'learner',
            options: areaOptions,
            onChange: (value) => {
              if (selectedFeature) {
                handleUpdate({ area: value as Feature['area'] });
              } else {
                setNewFeatureData(prev => ({ ...prev, area: value as Feature['area'] }));
              }
            },
          },
          {
            key: 'dueDate',
            label: 'Due Date',
            type: 'date',
            value: selectedFeature?.dueDate || newFeatureData.dueDate,
            onChange: (value) => {
              if (selectedFeature) {
                handleUpdate({ dueDate: value });
              } else {
                setNewFeatureData(prev => ({ ...prev, dueDate: value }));
              }
            },
          },
          {
            key: 'completionDate',
            label: 'Completion Date',
            type: 'date',
            value: selectedFeature?.completionDate || newFeatureData.completionDate,
            onChange: (value) => {
              if (selectedFeature) {
                handleUpdate({ completionDate: value });
              } else {
                setNewFeatureData(prev => ({ ...prev, completionDate: value }));
              }
            },
          },
        ]}
        bodyFields={[
          {
            key: 'description',
            label: 'Description',
            value: selectedFeature?.description || newFeatureData.description || '',
            onChange: (value) => {
              if (selectedFeature) {
                handleUpdate({ description: value });
              } else {
                setNewFeatureData(prev => ({ ...prev, description: value }));
              }
            },
            placeholder: 'Describe the feature...',
          },
        ]}
        metadata={selectedFeature ? {
          createdAt: selectedFeature.createdAt,
          updatedAt: selectedFeature.updatedAt,
          createdBy: selectedFeature.createdBy,
        } : undefined}
        onSave={() => {
          if (selectedFeature) {
            setIsDrawerOpen(false);
          } else {
            handleCreate(newFeatureData);
          }
        }}
        onDelete={selectedFeature ? handleDelete : undefined}
        assignedTo={selectedFeature?.assignedTo || newFeatureData.assignedTo || null}
        teamMembers={projectId && supportsAssignment(projectId) ? getTeamMembers(projectId) : []}
        onAssignedToChange={(email) => {
          if (selectedFeature) {
            handleUpdate({ assignedTo: email || undefined });
          } else {
            setNewFeatureData(prev => ({ ...prev, assignedTo: email || undefined }));
          }
        }}
        showAssignment={projectId ? supportsAssignment(projectId) : false}
        accent={accent}
      />
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <ViewProvider moduleName="features" defaultViewType="table">
      <FeaturesContent />
    </ViewProvider>
  );
}
