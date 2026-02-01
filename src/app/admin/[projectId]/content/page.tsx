'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Content, getContent, createContent, updateContent, deleteContent } from '@/app/actions/content';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';

export default function ContentPage() {
  const { project, projectId } = useProject();
  const { user } = useAuth();
  const accentClasses = project?.accentClasses;
  
  const [content, setContent] = useState<Content[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');

  const { execute: loadContent, loading } = useServerAction(getContent);
  const { execute: handleCreateContent } = useServerAction(createContent);
  const { execute: handleUpdateContent } = useServerAction(updateContent);
  const { execute: handleDeleteContent } = useServerAction(deleteContent);

  useEffect(() => {
    if (projectId) {
      loadContent(projectId).then((data) => {
        if (data) setContent(data);
      });
    }
  }, [projectId]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contentType: 'article' as Content['contentType'],
    channel: 'web' as Content['channel'],
    publishAt: '',
    dueAt: '',
    status: 'idea' as Content['status'],
    owner: user?.email || '',
  });

  useEffect(() => {
    if (selectedContent) {
      setFormData({
        title: selectedContent.title,
        description: selectedContent.description,
        contentType: selectedContent.contentType,
        channel: selectedContent.channel,
        publishAt: selectedContent.publishAt ? new Date(selectedContent.publishAt).toISOString().split('T')[0] : '',
        dueAt: selectedContent.dueAt ? new Date(selectedContent.dueAt).toISOString().split('T')[0] : '',
        status: selectedContent.status,
        owner: selectedContent.owner,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        contentType: 'article',
        channel: 'web',
        publishAt: '',
        dueAt: '',
        status: 'idea',
        owner: user?.email || '',
      });
    }
  }, [selectedContent, isFormOpen, user]);

  const handleCreate = async (data: Omit<Content, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!projectId) return;
    await handleCreateContent(projectId, {
      ...data,
      publishAt: data.publishAt ? new Date(data.publishAt) : undefined,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
    });
    const updated = await loadContent(projectId);
    if (updated) setContent(updated);
  };

  const handleUpdate = async (data: Partial<Omit<Content, 'id' | 'createdAt' | 'updatedAt'>>) => {
    if (!projectId || !selectedContent) return;
    await handleUpdateContent(projectId, selectedContent.id, {
      ...data,
      publishAt: data.publishAt ? new Date(data.publishAt) : undefined,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
    });
    const updated = await loadContent(projectId);
    if (updated) setContent(updated);
    setSelectedContent(null);
  };

  const filteredContent = content.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (channelFilter && item.channel !== channelFilter) return false;
    return true;
  });

  const columns: Column<Content>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (item) => (
        <div>
          <div className="font-medium">{item.title}</div>
          <div className="text-sm text-gray-400 line-clamp-1">{item.description}</div>
        </div>
      ),
    },
    {
      key: 'contentType',
      header: 'Type',
      render: (item) => (
        <Badge variant="default" className="capitalize">
          {item.contentType.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      render: (item) => (
        <Badge variant="default" className="capitalize">
          {item.channel}
        </Badge>
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
              handleUpdateContent(projectId, item.id, { status: e.target.value as Content['status'] }).then(() => {
                loadContent(projectId).then((data) => {
                  if (data) setContent(data);
                });
              });
            }
          }}
          accent
          className="w-40"
        >
          <option value="idea">Idea</option>
          <option value="in_creation">In Creation</option>
          <option value="ready">Ready</option>
          <option value="scheduled">Scheduled</option>
          <option value="sent">Sent</option>
          <option value="verified">Verified</option>
        </Select>
      ),
    },
    {
      key: 'dueAt',
      header: 'Due Date',
      render: (item) => (
        <span className="text-sm text-gray-400">
          {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : '-'}
        </span>
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
              setSelectedContent(item);
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
              if (confirm('Delete this content?')) {
                handleDeleteContent(projectId!, item.id).then(() => {
                  loadContent(projectId!).then((data) => {
                    if (data) setContent(data);
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
            Content Pipeline
          </h1>
          <div className={cn('h-1 w-24 rounded', accentClasses?.bg)} />
          <p className="text-gray-400 mt-4">
            Manage content creation, scheduling, and publishing
          </p>
        </div>
        <Button variant="primary" accent onClick={() => {
          setSelectedContent(null);
          setIsFormOpen(true);
        }}>
          New Content
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading content...</div>
          ) : (
            <DataTable
              data={filteredContent}
              columns={columns}
              searchKey="title"
              searchPlaceholder="Search content..."
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: [
                    { value: 'idea', label: 'Idea' },
                    { value: 'in_creation', label: 'In Creation' },
                    { value: 'ready', label: 'Ready' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'sent', label: 'Sent' },
                    { value: 'verified', label: 'Verified' },
                  ],
                  value: statusFilter,
                  onChange: setStatusFilter,
                },
                {
                  key: 'channel',
                  label: 'Channel',
                  options: [
                    { value: 'instagram', label: 'Instagram' },
                    { value: 'whatsapp', label: 'WhatsApp' },
                    { value: 'email', label: 'Email' },
                    { value: 'app', label: 'App' },
                    { value: 'web', label: 'Web' },
                  ],
                  value: channelFilter,
                  onChange: setChannelFilter,
                },
              ]}
              emptyMessage="No content found. Create your first content item!"
              accent
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedContent(null);
        }}
        title={selectedContent ? 'Edit Content' : 'Create Content'}
        accent
        size="lg"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (selectedContent) {
              await handleUpdate(formData);
            } else {
              await handleCreate(formData);
            }
            setIsFormOpen(false);
            setSelectedContent(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required accent />
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
              <label className="block text-sm font-medium text-gray-300 mb-2">Content Type</label>
              <Select value={formData.contentType} onChange={(e) => setFormData({ ...formData, contentType: e.target.value as Content['contentType'] })} accent>
                <option value="video">Video</option>
                <option value="article">Article</option>
                <option value="tips_tricks">Tips & Tricks</option>
                <option value="notification">Notification</option>
                <option value="email_campaign">Email Campaign</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Channel</label>
              <Select value={formData.channel} onChange={(e) => setFormData({ ...formData, channel: e.target.value as Content['channel'] })} accent>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="app">App</option>
                <option value="web">Web</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Publish At</label>
              <Input type="date" value={formData.publishAt} onChange={(e) => setFormData({ ...formData, publishAt: e.target.value })} accent />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Due At</label>
              <Input type="date" value={formData.dueAt} onChange={(e) => setFormData({ ...formData, dueAt: e.target.value })} accent />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <Select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as Content['status'] })} accent>
              <option value="idea">Idea</option>
              <option value="in_creation">In Creation</option>
              <option value="ready">Ready</option>
              <option value="scheduled">Scheduled</option>
              <option value="sent">Sent</option>
              <option value="verified">Verified</option>
            </Select>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="secondary" onClick={() => { setIsFormOpen(false); setSelectedContent(null); }}>Cancel</Button>
            <Button type="submit" variant="primary" accent>{selectedContent ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
