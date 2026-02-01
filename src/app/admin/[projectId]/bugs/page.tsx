'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { BugForm } from '@/components/bugs/BugForm';
import { Bug, getBugs, createBug, updateBug, deleteBug } from '@/app/actions/bugs';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

export default function BugsPage() {
  const { project, projectId } = useProject();
  const accentClasses = project?.accentClasses;
  
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [platformFilter, setPlatformFilter] = useState<string>('');

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

  const handleCreate = async (data: Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!projectId) return;
    await handleCreateBug(projectId, data);
    // Reload bugs
    const updated = await loadBugs(projectId);
    if (updated) setBugs(updated);
  };

  const handleUpdate = async (data: Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!projectId || !selectedBug) return;
    await handleUpdateBug(projectId, selectedBug.id, data);
    // Reload bugs
    const updated = await loadBugs(projectId);
    if (updated) setBugs(updated);
    setSelectedBug(null);
  };

  const handleDelete = async (bugId: string) => {
    if (!projectId) return;
    if (confirm('Are you sure you want to delete this bug?')) {
      await handleDeleteBug(projectId, bugId);
      // Reload bugs
      const updated = await loadBugs(projectId);
      if (updated) setBugs(updated);
    }
  };

  const handleStatusChange = async (bug: Bug, newStatus: Bug['status']) => {
    if (!projectId) return;
    await handleUpdateBug(projectId, bug.id, { status: newStatus });
    // Reload bugs
    const updated = await loadBugs(projectId);
    if (updated) setBugs(updated);
  };

  const filteredBugs = bugs.filter((bug) => {
    if (statusFilter && bug.status !== statusFilter) return false;
    if (platformFilter && bug.platform !== platformFilter) return false;
    return true;
  });

  const columns: Column<Bug>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (bug) => (
        <div>
          <div className="font-medium">{bug.title}</div>
          <div className="text-sm text-gray-400 line-clamp-1">{bug.description}</div>
        </div>
      ),
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (bug) => (
        <Badge variant="default" className="uppercase">
          {bug.platform}
        </Badge>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (bug) => {
        const severityColors: Record<string, string> = {
          critical: 'text-red-400',
          high: 'text-orange-400',
          medium: 'text-yellow-400',
          low: 'text-gray-400',
        };
        return (
          <span className={cn('font-medium capitalize', severityColors[bug.severity])}>
            {bug.severity}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (bug) => (
        <Select
          value={bug.status}
          onChange={(e) => handleStatusChange(bug, e.target.value as Bug['status'])}
          accent
          className="w-40"
        >
          <option value="reported">Reported</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="fixed">Fixed</option>
          <option value="verified">Verified</option>
        </Select>
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (bug) => (
        <div className="flex flex-wrap gap-1">
          {bug.tags?.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="default" className="text-xs">
              {tag}
            </Badge>
          ))}
          {bug.tags && bug.tags.length > 2 && (
            <Badge variant="default" className="text-xs">
              +{bug.tags.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (bug) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBug(bug);
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
              handleDelete(bug.id);
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
            Bugs
          </h1>
          <div className={cn('h-1 w-24 rounded', accentClasses?.bg)} />
          <p className="text-gray-400 mt-4">
            Track and manage bugs across platforms
          </p>
        </div>
        <Button
          variant="primary"
          accent
          onClick={() => {
            setSelectedBug(null);
            setIsFormOpen(true);
          }}
        >
          New Bug
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading bugs...</div>
          ) : (
            <DataTable
              data={filteredBugs}
              columns={columns}
              searchKey="title"
              searchPlaceholder="Search bugs..."
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: [
                    { value: 'reported', label: 'Reported' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'blocked', label: 'Blocked' },
                    { value: 'fixed', label: 'Fixed' },
                    { value: 'verified', label: 'Verified' },
                  ],
                  value: statusFilter,
                  onChange: setStatusFilter,
                },
                {
                  key: 'platform',
                  label: 'Platform',
                  options: [
                    { value: 'ios', label: 'iOS' },
                    { value: 'web', label: 'Web' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'backend', label: 'Backend' },
                  ],
                  value: platformFilter,
                  onChange: setPlatformFilter,
                },
              ]}
              emptyMessage="No bugs found. Create your first bug!"
              accent
            />
          )}
        </CardContent>
      </Card>

      <BugForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedBug(null);
        }}
        onSubmit={selectedBug ? handleUpdate : handleCreate}
        initialData={selectedBug}
      />
    </div>
  );
}
