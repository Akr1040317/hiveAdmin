'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Bug } from '@/app/actions/bugs';
import { useProject } from '@/contexts/ProjectContext';

interface BugFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Bug, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<void>;
  initialData?: Bug | null;
}

export function BugForm({ isOpen, onClose, onSubmit, initialData }: BugFormProps) {
  const { project } = useProject();
  const accentClasses = project?.accentClasses;
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    platform: 'web' as Bug['platform'],
    severity: 'medium' as Bug['severity'],
    status: 'reported' as Bug['status'],
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title,
        description: initialData.description,
        platform: initialData.platform,
        severity: initialData.severity,
        status: initialData.status,
        tags: initialData.tags || [],
      });
    } else {
      setFormData({
        title: '',
        description: '',
        platform: 'web',
        severity: 'medium',
        status: 'reported',
        tags: [],
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting bug:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Bug' : 'Create Bug'}
      accent
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-300 mb-2">Platform</label>
            <Select
              value={formData.platform}
              onChange={(e) => setFormData({ ...formData, platform: e.target.value as Bug['platform'] })}
              accent
            >
              <option value="ios">iOS</option>
              <option value="web">Web</option>
              <option value="admin">Admin</option>
              <option value="backend">Backend</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Severity</label>
            <Select
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value as Bug['severity'] })}
              accent
            >
              <option value="critical">Critical</option>
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
            onChange={(e) => setFormData({ ...formData, status: e.target.value as Bug['status'] })}
            accent
          >
            <option value="reported">Reported</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="fixed">Fixed</option>
            <option value="verified">Verified</option>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
          <div className="flex gap-2 mb-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add tag..."
              accent
            />
            <Button type="button" onClick={addTag} variant="secondary">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-background-hover rounded text-sm text-gray-300"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" accent disabled={loading}>
            {loading ? 'Saving...' : initialData ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
