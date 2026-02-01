'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Feature, getFeatures, createFeature, updateFeature, deleteFeature } from '@/app/actions/features';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export default function FeaturesPage() {
  const { project, projectId } = useProject();
  const accentClasses = project?.accentClasses;
  
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [areaFilter, setAreaFilter] = useState<string>('');

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

  const handleCreate = async (data: Omit<Feature, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!projectId) return;
    await handleCreateFeature(projectId, data);
    const updated = await loadFeatures(projectId);
    if (updated) setFeatures(updated);
  };

  const handleUpdate = async (data: Omit<Feature, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!projectId || !selectedFeature) return;
    await handleUpdateFeature(projectId, selectedFeature.id, data);
    const updated = await loadFeatures(projectId);
    if (updated) setFeatures(updated);
    setSelectedFeature(null);
  };

  const handleDelete = async (featureId: string) => {
    if (!projectId) return;
    if (confirm('Are you sure you want to delete this feature?')) {
      await handleDeleteFeature(projectId, featureId);
      const updated = await loadFeatures(projectId);
      if (updated) setFeatures(updated);
    }
  };

  const filteredFeatures = features.filter((feature) => {
    if (statusFilter && feature.status !== statusFilter) return false;
    if (areaFilter && feature.area !== areaFilter) return false;
    return true;
  });

  const columns: Column<Feature>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (feature) => (
        <div>
          <div className="font-medium">{feature.title}</div>
          <div className="text-sm text-gray-400 line-clamp-1">{feature.description}</div>
        </div>
      ),
    },
    {
      key: 'area',
      header: 'Area',
      render: (feature) => (
        <Badge variant="default" className="capitalize">
          {feature.area}
        </Badge>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (feature) => {
        const priorityColors: Record<string, string> = {
          high: 'text-red-400',
          medium: 'text-yellow-400',
          low: 'text-gray-400',
        };
        return (
          <span className={cn('font-medium capitalize', priorityColors[feature.priority])}>
            {feature.priority}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (feature) => (
        <Select
          value={feature.status}
          onChange={(e) => {
            if (projectId) {
              handleUpdateFeature(projectId, feature.id, { status: e.target.value as Feature['status'] }).then(() => {
                loadFeatures(projectId).then((data) => {
                  if (data) setFeatures(data);
                });
              });
            }
          }}
          accent
          className="w-40"
        >
          <option value="idea">Idea</option>
          <option value="planned">Planned</option>
          <option value="in_development">In Development</option>
          <option value="released">Released</option>
        </Select>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (feature) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFeature(feature);
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
              handleDelete(feature.id);
            }}
            className="text-red-400 hover:text-red-300"
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    area: 'learner' as Feature['area'],
    priority: 'medium' as Feature['priority'],
    status: 'idea' as Feature['status'],
  });

  useEffect(() => {
    if (selectedFeature) {
      setFormData({
        title: selectedFeature.title,
        description: selectedFeature.description,
        area: selectedFeature.area,
        priority: selectedFeature.priority,
        status: selectedFeature.status,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        area: 'learner',
        priority: 'medium',
        status: 'idea',
      });
    }
  }, [selectedFeature, isFormOpen]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className={cn('text-3xl font-bold mb-2', accentClasses?.text)}>
            Features
          </h1>
          <div className={cn('h-1 w-24 rounded', accentClasses?.bg)} />
          <p className="text-gray-400 mt-4">
            Feature planning and development tracking
          </p>
        </div>
        <Button
          variant="primary"
          accent
          onClick={() => {
            setSelectedFeature(null);
            setIsFormOpen(true);
          }}
        >
          New Feature
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading features...</div>
          ) : (
            <DataTable
              data={filteredFeatures}
              columns={columns}
              searchKey="title"
              searchPlaceholder="Search features..."
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: [
                    { value: 'idea', label: 'Idea' },
                    { value: 'planned', label: 'Planned' },
                    { value: 'in_development', label: 'In Development' },
                    { value: 'released', label: 'Released' },
                  ],
                  value: statusFilter,
                  onChange: setStatusFilter,
                },
                {
                  key: 'area',
                  label: 'Area',
                  options: [
                    { value: 'learner', label: 'Learner' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'content', label: 'Content' },
                    { value: 'ops', label: 'Ops' },
                  ],
                  value: areaFilter,
                  onChange: setAreaFilter,
                },
              ]}
              emptyMessage="No features found. Create your first feature!"
              accent
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedFeature(null);
        }}
        title={selectedFeature ? 'Edit Feature' : 'Create Feature'}
        accent
        size="lg"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (selectedFeature) {
              await handleUpdate(formData);
            } else {
              await handleCreate(formData);
            }
            setIsFormOpen(false);
            setSelectedFeature(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              accent
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-violet-500/40 focus:border-violet-500/30"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Area</label>
              <Select
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value as Feature['area'] })}
                accent
              >
                <option value="learner">Learner</option>
                <option value="admin">Admin</option>
                <option value="content">Content</option>
                <option value="ops">Ops</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as Feature['priority'] })}
                accent
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Feature['status'] })}
              accent
            >
              <option value="idea">Idea</option>
              <option value="planned">Planned</option>
              <option value="in_development">In Development</option>
              <option value="released">Released</option>
            </Select>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsFormOpen(false);
                setSelectedFeature(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" accent>
              {selectedFeature ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
