'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { ViewProvider, useView } from '@/contexts/ViewContext';
import { ViewToolbar } from '@/components/shared/ViewToolbar';
import { ViewTabs } from '@/components/shared/ViewTabs';
import { TableView, TableColumn } from '@/components/shared/TableView';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { Document, getDocuments, createDocumentItem, updateDocumentItem, deleteDocumentItem } from '@/app/actions/documents';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Filter, Sort } from '@/lib/views';
import { format } from 'date-fns';
import { ExternalLink, FileText } from 'lucide-react';

function DocumentsContent() {
  const { project, projectId } = useProject();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);

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

  const filteredDocuments = useMemo(() => {
    let result = documents;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(d => 
        d.title.toLowerCase().includes(searchLower) ||
        (d.notes && d.notes.toLowerCase().includes(searchLower)) ||
        (d.url && d.url.toLowerCase().includes(searchLower))
      );
    }
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(d => (d as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(d => (d as any)[filter.field] !== filter.value);
      }
    });
    return result;
  }, [documents, search, filters]);

  const handleCreate = async (data: Partial<Document>) => {
    if (!projectId) return;
    const newDoc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> = {
      title: data.title || 'Untitled Document',
      type: data.type || 'other',
      url: data.url || '',
      notes: data.notes || '',
    };
    await handleCreateDocument(projectId, newDoc);
    const updated = await loadDocuments(projectId);
    if (updated) setDocuments(updated);
    setIsDrawerOpen(false);
  };

  const handleUpdate = async (updates: Partial<Document>) => {
    if (!projectId || !selectedDocument) return;
    await handleUpdateDocument(projectId, selectedDocument.id, updates);
    const updated = await loadDocuments(projectId);
    if (updated) setDocuments(updated);
    setSelectedDocument({ ...selectedDocument, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedDocument) return;
    if (confirm('Are you sure?')) {
      await handleDeleteDocument(projectId, selectedDocument.id);
      const updated = await loadDocuments(projectId);
      if (updated) setDocuments(updated);
      setIsDrawerOpen(false);
      setSelectedDocument(null);
    }
  };

  const availableFields = [
    { value: 'title', label: 'Title', type: 'text' as const },
    { value: 'type', label: 'Type', type: 'select' as const },
    { value: 'updatedAt', label: 'Updated', type: 'date' as const },
  ];

  const typeOptions = [
    { value: 'contract', label: 'Contract' },
    { value: 'schedule', label: 'Schedule' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'ops', label: 'Ops' },
    { value: 'legal', label: 'Legal' },
    { value: 'other', label: 'Other' },
  ];

  const getTypeColor = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'contract') return 'bg-blue-500';
    if (t === 'schedule') return 'bg-purple-500';
    if (t === 'marketing') return 'bg-pink-500';
    if (t === 'ops') return 'bg-orange-500';
    if (t === 'legal') return 'bg-red-500';
    return 'bg-gray-500';
  };

  const tableColumns: TableColumn<Document>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (d) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <div>
            <div className="font-semibold text-sm text-gray-50">{d.title}</div>
            {d.notes && (
              <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{d.notes}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      type: 'badge',
      render: (d) => {
        const color = getTypeColor(d.type);
        return (
          <Badge className={cn(
            'text-xs capitalize',
            color === 'bg-blue-500' && 'bg-blue-500/20 text-blue-400 border-blue-500/40',
            color === 'bg-purple-500' && 'bg-purple-500/20 text-purple-400 border-purple-500/40',
            color === 'bg-pink-500' && 'bg-pink-500/20 text-pink-400 border-pink-500/40',
            color === 'bg-orange-500' && 'bg-orange-500/20 text-orange-400 border-orange-500/40',
            color === 'bg-red-500' && 'bg-red-500/20 text-red-400 border-red-500/40'
          )}>
            {d.type}
          </Badge>
        );
      },
    },
    {
      key: 'url',
      header: 'Link',
      sortable: false,
      render: (d) => (
        d.url ? (
          <a
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            Open
          </a>
        ) : (
          <span className="text-xs text-gray-500">—</span>
        )
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortable: true,
      type: 'date',
      render: (d) => (
        <span className="text-xs text-gray-400">
          {format(new Date(d.updatedAt), 'MMM d, yyyy')}
        </span>
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
            <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Documents</h1>
            <p className="text-sm text-gray-400">Store and organize important documents</p>
          </div>
        </div>
      </div>

      <ViewTabs availableViewTypes={['table']} onViewTypeChange={(vt) => {
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
          setSelectedDocument(null);
          setIsDrawerOpen(true);
        }}
        viewType={viewType}
        accent={accent}
      />

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading documents...</div>
        ) : (
          <TableView
            data={filteredDocuments}
            columns={tableColumns}
            sorts={sorts}
            onSortChange={(newSorts) => {
              setSorts(newSorts);
              updateCurrentView({ sorts: newSorts });
            }}
            visibleColumns={currentView?.visibleColumns}
            onRowClick={(d) => {
              setSelectedDocument(d);
              setIsDrawerOpen(true);
            }}
            onQuickAdd={() => {
              setSelectedDocument(null);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No documents found. Create your first document!"
            accent={accent}
          />
        )}
      </div>

      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedDocument(null);
        }}
        title={selectedDocument?.title || 'New Document'}
        onTitleChange={(title) => {
          if (selectedDocument) handleUpdate({ title });
        }}
        properties={[
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            value: selectedDocument?.type || 'other',
            options: typeOptions,
            onChange: (value) => {
              if (selectedDocument) handleUpdate({ type: value as Document['type'] });
            },
          },
          {
            key: 'url',
            label: 'URL',
            type: 'text',
            value: selectedDocument?.url || '',
            onChange: (value) => {
              if (selectedDocument) handleUpdate({ url: value });
            },
          },
        ]}
        bodyFields={[
          {
            key: 'notes',
            label: 'Notes',
            value: selectedDocument?.notes || '',
            onChange: (value) => {
              if (selectedDocument) handleUpdate({ notes: value });
            },
            placeholder: 'Document notes...',
          },
        ]}
        metadata={selectedDocument ? {
          createdAt: selectedDocument.createdAt,
          updatedAt: selectedDocument.updatedAt,
        } : undefined}
        onSave={() => {
          if (selectedDocument) {
            setIsDrawerOpen(false);
          } else {
            handleCreate({ title: 'Untitled Document' });
          }
        }}
        onDelete={selectedDocument ? handleDelete : undefined}
        accent={accent}
      />
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <ViewProvider moduleName="documents" defaultViewType="table">
      <DocumentsContent />
    </ViewProvider>
  );
}
