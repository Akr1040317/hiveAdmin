'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Document, getDocuments, createDocumentItem, updateDocumentItem, deleteDocumentItem } from '@/app/actions/documents';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export default function DocumentsPage() {
  const { project, projectId } = useProject();
  const accentClasses = project?.accentClasses;
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { execute: loadDocuments, loading } = useServerAction(getDocuments);
  const { execute: handleCreateDocument } = useServerAction(createDocumentItem);
  const { execute: handleUpdateDocument } = useServerAction(updateDocumentItem);
  const { execute: handleDeleteDocument } = useServerAction(deleteDocumentItem);

  useEffect(() => {
    if (projectId) {
      loadDocuments(projectId).then((data) => {
        if (data) setDocuments(data);
      });
    }
  }, [projectId]);

  const [formData, setFormData] = useState({
    title: '',
    type: 'other' as Document['type'],
    url: '',
    notes: '',
  });

  useEffect(() => {
    if (selectedDocument) {
      setFormData({
        title: selectedDocument.title,
        type: selectedDocument.type,
        url: selectedDocument.url || '',
        notes: selectedDocument.notes || '',
      });
    } else {
      setFormData({
        title: '',
        type: 'other',
        url: '',
        notes: '',
      });
    }
  }, [selectedDocument, isFormOpen]);

  const handleCreate = async (data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!projectId) return;
    await handleCreateDocument(projectId, data);
    const updated = await loadDocuments(projectId);
    if (updated) setDocuments(updated);
  };

  const handleUpdate = async (data: Partial<Omit<Document, 'id' | 'createdAt' | 'updatedAt'>>) => {
    if (!projectId || !selectedDocument) return;
    await handleUpdateDocument(projectId, selectedDocument.id, data);
    const updated = await loadDocuments(projectId);
    if (updated) setDocuments(updated);
    setSelectedDocument(null);
  };

  const filteredDocuments = documents.filter((doc) => {
    if (typeFilter && doc.type !== typeFilter) return false;
    return true;
  });

  const columns: Column<Document>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (doc) => (
        <div>
          <div className="font-medium">{doc.title}</div>
          {doc.notes && (
            <div className="text-sm text-gray-400 line-clamp-1">{doc.notes}</div>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (doc) => (
        <Badge variant="default" className="capitalize">
          {doc.type}
        </Badge>
      ),
    },
    {
      key: 'url',
      header: 'Link',
      render: (doc) => (
        doc.url ? (
          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-sm">
            Open →
          </a>
        ) : (
          <span className="text-gray-500 text-sm">-</span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (doc) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDocument(doc);
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
              if (confirm('Delete this document?')) {
                handleDeleteDocument(projectId!, doc.id).then(() => {
                  loadDocuments(projectId!).then((data) => {
                    if (data) setDocuments(data);
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
            Document Center
          </h1>
          <div className={cn('h-1 w-24 rounded', accentClasses?.bg)} />
          <p className="text-gray-400 mt-4">
            Store and organize project documents
          </p>
        </div>
        <Button variant="primary" accent onClick={() => {
          setSelectedDocument(null);
          setIsFormOpen(true);
        }}>
          New Document
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading documents...</div>
          ) : (
            <DataTable
              data={filteredDocuments}
              columns={columns}
              searchKey="title"
              searchPlaceholder="Search documents..."
              filters={[
                {
                  key: 'type',
                  label: 'Type',
                  options: [
                    { value: 'contract', label: 'Contract' },
                    { value: 'schedule', label: 'Schedule' },
                    { value: 'marketing', label: 'Marketing' },
                    { value: 'ops', label: 'Ops' },
                    { value: 'legal', label: 'Legal' },
                    { value: 'other', label: 'Other' },
                  ],
                  value: typeFilter,
                  onChange: setTypeFilter,
                },
              ]}
              emptyMessage="No documents found. Add your first document!"
              accent
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedDocument(null);
        }}
        title={selectedDocument ? 'Edit Document' : 'Create Document'}
        accent
        size="lg"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (selectedDocument) {
              await handleUpdate(formData);
            } else {
              await handleCreate(formData);
            }
            setIsFormOpen(false);
            setSelectedDocument(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required accent />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <Select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as Document['type'] })} accent>
              <option value="contract">Contract</option>
              <option value="schedule">Schedule</option>
              <option value="marketing">Marketing</option>
              <option value="ops">Ops</option>
              <option value="legal">Legal</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">URL</label>
            <Input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="https://..." accent />
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
            <Button type="button" variant="secondary" onClick={() => { setIsFormOpen(false); setSelectedDocument(null); }}>Cancel</Button>
            <Button type="submit" variant="primary" accent>{selectedDocument ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
