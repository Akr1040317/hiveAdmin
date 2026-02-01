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
import { Content, getContent, createContent, updateContent, deleteContent } from '@/app/actions/content';
import { useServerAction } from '@/hooks/useServerAction';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Filter, Sort } from '@/lib/views';
import { format, isAfter } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  getContentRequirements,
  checkRequirementCompliance,
  ContentRequirement,
  confirmRequirement,
  markRequirementMissed,
  ContentRequirementType,
} from '@/app/actions/content-requirements';
import { RequirementStatus } from '@/components/content/RequirementStatus';
import { RequirementTracker } from '@/components/content/RequirementTracker';
import { isContentInPeriod, formatPeriodKey, getPeriodStart } from '@/lib/content-requirements';
import { Card, CardContent } from '@/components/ui/Card';
import { getTeamMembers, supportsAssignment } from '@/lib/team-members';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, AlertCircle } from 'lucide-react';

function ContentContent() {
  const { project, projectId } = useProject();
  const { user } = useAuth();
  const { currentView, updateCurrentView, switchViewType } = useView();
  const accentClasses = project?.accentClasses;
  
  const [content, setContent] = useState<Content[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sorts, setSorts] = useState<Sort[]>([]);
  const [linkedRequirement, setLinkedRequirement] = useState<ContentRequirement | null>(null);
  const [allRequirements, setAllRequirements] = useState<ContentRequirement[]>([]);

  const { execute: loadContent, loading } = useServerAction(getContent);
  const { execute: handleCreateContent } = useServerAction(createContent);
  const { execute: handleUpdateContent } = useServerAction(updateContent);
  const { execute: handleDeleteContent } = useServerAction(deleteContent);
  const { execute: loadRequirements } = useServerAction(getContentRequirements);
  const { execute: checkCompliance } = useServerAction(checkRequirementCompliance);
  const { execute: confirmReq } = useServerAction(confirmRequirement);
  const { execute: markMissed } = useServerAction(markRequirementMissed);

  useEffect(() => {
    if (projectId) {
      loadContent(projectId).then((data) => {
        if (data) {
          setContent(data);
          // Check compliance when content loads (non-blocking)
          checkCompliance(projectId).catch((error) => {
            // Silently fail - compliance check is optional
            console.error('Failed to check compliance:', error);
          });
        }
      });
      
      // Load all requirements for tracker view
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);
      loadRequirements(projectId, {
        startDate: new Date(),
        endDate,
      }).then((reqs) => {
        if (reqs) setAllRequirements(reqs);
      });
    }
  }, [projectId]);

  useEffect(() => {
    if (selectedContent && projectId) {
      // Find linked requirement for selected content
      loadRequirements(projectId, {
        contentType: selectedContent.contentType as any,
      }).then((reqs) => {
        if (reqs && selectedContent.publishAt) {
          const matching = reqs.find((req) =>
            isContentInPeriod(selectedContent, req)
          );
          setLinkedRequirement(matching || null);
        } else {
          setLinkedRequirement(null);
        }
      });
    } else {
      setLinkedRequirement(null);
    }
  }, [selectedContent, projectId]);

  const filteredContent = useMemo(() => {
    let result = content;
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(c => 
        c.title.toLowerCase().includes(searchLower) ||
        c.description.toLowerCase().includes(searchLower)
      );
    }
    filters.forEach(filter => {
      if (filter.operator === 'equals') {
        result = result.filter(c => (c as any)[filter.field] === filter.value);
      } else if (filter.operator === 'not_equals') {
        result = result.filter(c => (c as any)[filter.field] !== filter.value);
      }
    });
    return result;
  }, [content, search, filters]);

  const handleCreate = async (data: Partial<Content>) => {
    if (!projectId) return;
    
    // Calculate requirement period if publishAt is set
    let requirementPeriod: string | undefined;
    if (data.publishAt) {
      const contentType = data.contentType || 'article';
      const periodType = contentType === 'word_of_the_day' ? 'daily' : 'weekly';
      const periodStart = getPeriodStart(new Date(data.publishAt), periodType);
      requirementPeriod = formatPeriodKey(periodStart, periodType);
    }
    
    const newContent: Omit<Content, 'id' | 'createdAt' | 'updatedAt'> = {
      title: data.title || 'Untitled Content',
      description: data.description || '',
      contentType: data.contentType || 'article',
      channel: data.channel || 'web',
      publishAt: data.publishAt || new Date(),
      dueAt: data.dueAt,
      requirementPeriod,
      status: data.status || 'idea',
      owner: data.owner || user?.email || '',
    };
    await handleCreateContent(projectId, newContent);
    const updated = await loadContent(projectId);
    if (updated) {
      setContent(updated);
      // Check compliance after creating content
      await checkCompliance(projectId);
    }
    setIsDrawerOpen(false);
  };

  const handleUpdate = async (updates: Partial<Content>) => {
    if (!projectId || !selectedContent) return;
    
    // Calculate requirement period if publishAt is being updated
    if (updates.publishAt !== undefined) {
      const contentType = updates.contentType || selectedContent.contentType;
      const periodType = contentType === 'word_of_the_day' ? 'daily' : 'weekly';
      const periodStart = getPeriodStart(new Date(updates.publishAt), periodType);
      updates.requirementPeriod = formatPeriodKey(periodStart, periodType);
    }
    
    await handleUpdateContent(projectId, selectedContent.id, updates);
    const updated = await loadContent(projectId);
    if (updated) {
      setContent(updated);
      // Check compliance after updating content
      await checkCompliance(projectId);
    }
    setSelectedContent({ ...selectedContent, ...updates });
  };

  const handleDelete = async () => {
    if (!projectId || !selectedContent) return;
    if (confirm('Are you sure?')) {
      await handleDeleteContent(projectId, selectedContent.id);
      const updated = await loadContent(projectId);
      if (updated) setContent(updated);
      setIsDrawerOpen(false);
      setSelectedContent(null);
    }
  };

  const handleCardMove = async (contentId: string, newStatus: Content['status']) => {
    if (!projectId) return;
    
    // Validate verification before allowing scheduled/sent
    const contentItem = content.find(c => c.id === contentId);
    if ((newStatus === 'scheduled' || newStatus === 'sent') && contentItem?.status !== 'verified') {
      alert('Content must be verified before it can be scheduled or sent. Please verify the content first.');
      return;
    }
    
    await handleUpdateContent(projectId, contentId, { status: newStatus });
    const updated = await loadContent(projectId);
    if (updated) setContent(updated);
  };

  const availableFields = [
    { value: 'title', label: 'Title', type: 'text' as const },
    { value: 'status', label: 'Status', type: 'select' as const },
    { value: 'contentType', label: 'Content Type', type: 'select' as const },
    { value: 'channel', label: 'Channel', type: 'select' as const },
    { value: 'publishAt', label: 'Publish Date', type: 'date' as const },
    { value: 'dueAt', label: 'Due Date', type: 'date' as const },
  ];

  const statusOptions = [
    { value: 'idea', label: 'Idea' },
    { value: 'in_creation', label: 'In Creation' },
    { value: 'ready', label: 'Ready' },
    { value: 'verified', label: 'Verified' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'sent', label: 'Sent' },
  ];
  
  const teamMembers = supportsAssignment(projectId) ? getTeamMembers(projectId) : [];

  const contentTypeOptions = [
    { value: 'video', label: 'Video' },
    { value: 'article', label: 'Article' },
    { value: 'tips_tricks', label: 'Tips & Tricks' },
    { value: 'notification', label: 'Notification' },
    { value: 'email_campaign', label: 'Email Campaign' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'word_of_the_day', label: 'Word of the Day' },
  ];

  const channelOptions = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'email', label: 'Email' },
    { value: 'app', label: 'App' },
    { value: 'web', label: 'Web' },
  ];

  const isOverdue = (item: Content) => {
    if (!item.dueAt) return false;
    const due = new Date(item.dueAt);
    const now = new Date();
    return isAfter(now, due) && item.status !== 'sent' && item.status !== 'verified';
  };

  const getStatusColor = (item: Content): string => {
    if (isOverdue(item)) return '#ef4444'; // red-500
    const s = item.status.toLowerCase();
    if (s === 'sent' || s === 'verified') return '#22c55e'; // green-500
    if (s === 'scheduled' || s === 'ready') return '#3b82f6'; // blue-500
    if (s === 'in_creation') return '#eab308'; // yellow-500
    return '#6b7280'; // gray-500
  };

  const tableColumns: TableColumn<Content>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (c) => (
        <div>
          <div className="font-semibold text-sm text-gray-50">{c.title}</div>
          <div className="text-xs text-gray-400 line-clamp-1 mt-0.5">{c.description}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      type: 'select',
      options: statusOptions,
      onEdit: (c, value) => handleCardMove(c.id, value as Content['status']),
    },
    {
      key: 'contentType',
      header: 'Type',
      sortable: true,
      type: 'badge',
      render: (c) => (
        <Badge variant="secondary" className="text-xs capitalize">
          {c.contentType.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'channel',
      header: 'Channel',
      sortable: true,
      type: 'badge',
      render: (c) => (
        <Badge variant="secondary" className="text-xs capitalize">
          {c.channel}
        </Badge>
      ),
    },
    {
      key: 'publishAt',
      header: 'Publish Date',
      sortable: true,
      type: 'date',
      render: (c) => (
        <span className="text-xs text-gray-400">
          {c.publishAt ? format(new Date(c.publishAt), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'dueAt',
      header: 'Due Date',
      sortable: true,
      type: 'date',
      render: (c) => (
        <span className={cn(
          'text-xs',
          isOverdue(c) ? 'text-red-400 font-semibold' : 'text-gray-400'
        )}>
          {c.dueAt ? format(new Date(c.dueAt), 'MMM d, yyyy') : '—'}
          {isOverdue(c) && ' ⚠️'}
        </span>
      ),
    },
    {
      key: 'requirementPeriod',
      header: 'Requirement',
      sortable: true,
      render: (c) => (
        <span className="text-xs text-gray-400">
          {c.requirementPeriod || '—'}
        </span>
      ),
    },
    ...(supportsAssignment(projectId) ? [{
      key: 'assignedTo',
      header: 'ASSIGNED TO',
      sortable: true,
      render: (c) => (
        <span className="text-xs text-gray-400">
          {c.assignedTo ? c.assignedTo.split('@')[0] : 'Unassigned'}
        </span>
      ),
    }] : []),
  ];

  const boardColumns = [
    { id: 'idea', title: 'Idea', status: 'idea' },
    { id: 'in_creation', title: 'In Creation', status: 'in_creation' },
    { id: 'ready', title: 'Ready', status: 'ready' },
    { id: 'scheduled', title: 'Scheduled', status: 'scheduled' },
    { id: 'sent', title: 'Sent', status: 'sent' },
    { id: 'verified', title: 'Verified', status: 'verified' },
  ];

  const [localViewType, setLocalViewType] = useState<'table' | 'board' | 'calendar' | 'tracker'>('table');
  const viewType = localViewType === 'tracker' ? 'tracker' : (currentView?.viewType || 'table');
  const accent = project?.accentColorKey || false;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-border-subtle bg-gradient-to-r from-background to-background-card/50">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('w-1 h-8 rounded-full', accentClasses?.bg.replace('/10', ''))} />
          <div>
            <h1 className={cn('text-2xl font-bold mb-0.5', accentClasses?.text)}>Content Pipeline</h1>
            <p className="text-sm text-gray-400">Manage content creation and publishing</p>
          </div>
        </div>
      </div>

      <ViewTabs 
        availableViewTypes={['table', 'board', 'calendar', 'tracker']} 
        onViewTypeChange={(vt) => {
          if (vt === 'tracker') {
            setLocalViewType('tracker');
          } else {
            setLocalViewType(vt as 'table' | 'board' | 'calendar');
            switchViewType(vt);
          }
        }} 
        currentViewType={viewType}
        accent={accent} 
      />

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
          setSelectedContent(null);
          setIsDrawerOpen(true);
        }}
        viewType={viewType}
        accent={accent}
      />

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading content...</div>
        ) : viewType === 'tracker' ? (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-200 mb-2">Weekly Requirements</h2>
              <p className="text-sm text-gray-400">Track weekly content publishing requirements</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {(['video', 'article', 'tips_tricks'] as ContentRequirementType[]).map((type) => (
                <Card key={type} className="bg-background-card/50 border-border-subtle">
                  <CardContent className="p-6">
                    <RequirementTracker
                      requirements={allRequirements}
                      contentType={type}
                      content={content}
                      onConfirm={async (reqId) => {
                        if (projectId && user?.email) {
                          await confirmReq(projectId, reqId, undefined, user.email);
                          // Reload requirements
                          const endDate = new Date();
                          endDate.setMonth(endDate.getMonth() + 3);
                          const reqs = await loadRequirements(projectId, {
                            startDate: new Date(),
                            endDate,
                          });
                          if (reqs) setAllRequirements(reqs);
                        }
                      }}
                      onMarkMissed={async (reqId) => {
                        if (projectId) {
                          await markMissed(projectId, reqId);
                          // Reload requirements
                          const endDate = new Date();
                          endDate.setMonth(endDate.getMonth() + 3);
                          const reqs = await loadRequirements(projectId, {
                            startDate: new Date(),
                            endDate,
                          });
                          if (reqs) setAllRequirements(reqs);
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-200 mb-2">Daily Requirements</h2>
              <p className="text-sm text-gray-400">Track daily Word of the Day publishing</p>
            </div>
            <Card className="bg-background-card/50 border-border-subtle">
              <CardContent className="p-6">
                <RequirementTracker
                  requirements={allRequirements}
                  contentType="word_of_the_day"
                  content={content}
                  onConfirm={async (reqId) => {
                    if (projectId && user?.email) {
                      await confirmReq(projectId, reqId, undefined, user.email);
                      // Reload requirements
                      const endDate = new Date();
                      endDate.setDate(endDate.getDate() + 30);
                      const reqs = await loadRequirements(projectId, {
                        startDate: new Date(),
                        endDate,
                      });
                      if (reqs) setAllRequirements(reqs);
                    }
                  }}
                  onMarkMissed={async (reqId) => {
                    if (projectId) {
                      await markMissed(projectId, reqId);
                      // Reload requirements
                      const endDate = new Date();
                      endDate.setDate(endDate.getDate() + 30);
                      const reqs = await loadRequirements(projectId, {
                        startDate: new Date(),
                        endDate,
                      });
                      if (reqs) setAllRequirements(reqs);
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>
        ) : viewType === 'table' ? (
          <TableView
            data={filteredContent}
            columns={tableColumns}
            sorts={sorts}
            onSortChange={(newSorts) => {
              setSorts(newSorts);
              updateCurrentView({ sorts: newSorts });
            }}
            visibleColumns={currentView?.visibleColumns}
            onRowClick={(c) => {
              setSelectedContent(c);
              setIsDrawerOpen(true);
            }}
            onQuickAdd={() => {
              setSelectedContent(null);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No content found. Create your first content!"
            accent={accent}
          />
        ) : viewType === 'board' ? (
          <BoardView
            data={filteredContent}
            columns={boardColumns}
            getCardData={(c) => ({
              title: c.title,
              subtitle: c.channel,
              badges: [
                { 
                  label: c.contentType.replace('_', ' '), 
                  variant: 'secondary' 
                },
                c.status === 'verified' && {
                  label: 'Verified',
                  variant: 'success',
                },
                c.reminderSent && {
                  label: 'Reminder Sent',
                  variant: 'warning',
                },
                isOverdue(c) && { 
                  label: 'Overdue', 
                  variant: 'critical' 
                },
              ].filter(Boolean) as any,
              updatedAt: c.updatedAt,
              userId: c.assignedTo?.split('@')[0] || c.owner?.split('@')[0] || 'user',
            })}
            onCardClick={(c) => {
              setSelectedContent(c);
              setIsDrawerOpen(true);
            }}
            onCardMove={handleCardMove}
            onAddCard={(status) => {
              setSelectedContent({ ...selectedContent, status: status as Content['status'] } as Content);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No content found. Create your first content!"
            accent={accent}
          />
        ) : (
          <CalendarView
            data={filteredContent}
            getDate={(c) => c.publishAt ? new Date(c.publishAt) : new Date()}
            getTitle={(c) => c.title}
            getStatus={(c) => c.status}
            getColor={getStatusColor}
            onItemClick={(c) => {
              setSelectedContent(c);
              setIsDrawerOpen(true);
            }}
            emptyMessage="No content found. Create your first content!"
            accent={accent}
          />
        )}
      </div>

      <DetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedContent(null);
        }}
        title={selectedContent?.title || 'New Content'}
        onTitleChange={(title) => {
          if (selectedContent) handleUpdate({ title });
        }}
        properties={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            value: selectedContent?.status || 'idea',
            options: statusOptions.filter(opt => {
              // Prevent selecting scheduled/sent if not verified
              if (!selectedContent) return true;
              if (opt.value === 'scheduled' || opt.value === 'sent') {
                return selectedContent.status === 'verified';
              }
              return true;
            }),
            onChange: (value) => {
              if (selectedContent) {
                // Validate verification before allowing scheduled/sent
                if ((value === 'scheduled' || value === 'sent') && selectedContent.status !== 'verified') {
                  alert('Content must be verified before it can be scheduled or sent. Please verify the content first.');
                  return;
                }
                handleUpdate({ status: value as Content['status'] });
              }
            },
          },
          {
            key: 'contentType',
            label: 'Content Type',
            type: 'select',
            value: selectedContent?.contentType || 'article',
            options: contentTypeOptions,
            onChange: (value) => {
              if (selectedContent) handleUpdate({ contentType: value as Content['contentType'] });
            },
          },
          {
            key: 'channel',
            label: 'Channel',
            type: 'select',
            value: selectedContent?.channel || 'web',
            options: channelOptions,
            onChange: (value) => {
              if (selectedContent) handleUpdate({ channel: value as Content['channel'] });
            },
          },
          {
            key: 'publishAt',
            label: 'Publish Date',
            type: 'date',
            value: selectedContent?.publishAt ? format(new Date(selectedContent.publishAt), 'yyyy-MM-dd') : '',
            onChange: (value) => {
              if (selectedContent) handleUpdate({ publishAt: value ? new Date(value) : undefined });
            },
          },
          {
            key: 'dueAt',
            label: 'Due Date',
            type: 'date',
            value: selectedContent?.dueAt ? format(new Date(selectedContent.dueAt), 'yyyy-MM-dd') : '',
            onChange: (value) => {
              if (selectedContent) handleUpdate({ dueAt: value ? new Date(value) : undefined });
            },
          },
        ]}
        showAssignment={supportsAssignment(projectId)}
        teamMembers={teamMembers}
        assignedTo={selectedContent?.assignedTo || null}
        onAssignedToChange={(email) => {
          if (selectedContent) handleUpdate({ assignedTo: email || undefined });
        }}
        bodyFields={[
          {
            key: 'description',
            label: 'Description',
            value: selectedContent?.description || '',
            onChange: (value) => {
              if (selectedContent) handleUpdate({ description: value });
            },
            placeholder: 'Content description...',
          },
        ]}
        customContent={
          <div className="mt-4 pt-4 border-t border-border-subtle space-y-4">
            {/* Verification Status */}
            {selectedContent && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Verification Status
                </h3>
                {selectedContent.status === 'verified' ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-400">Content Verified</p>
                      {selectedContent.verifiedAt && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Verified on {format(new Date(selectedContent.verifiedAt), 'MMM d, yyyy h:mm a')}
                          {selectedContent.verifiedBy && ` by ${selectedContent.verifiedBy.split('@')[0]}`}
                        </p>
                      )}
                    </div>
                  </div>
                ) : selectedContent.status === 'ready' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-400">Ready for Verification</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Content must be verified before it can be scheduled or sent
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        if (selectedContent) {
                          handleUpdate({ status: 'verified' });
                        }
                      }}
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      accent
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Verify Content
                    </Button>
                  </div>
                ) : (selectedContent.status === 'scheduled' || selectedContent.status === 'sent') && !selectedContent.verifiedAt ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-400">Not Verified</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        This content should be verified before publishing
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            
            {/* Reminder Status */}
            {selectedContent?.reminderSent && (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Reminder Status
                </h3>
                <p className="text-xs text-gray-400">
                  Reminder sent on {format(new Date(selectedContent.reminderSent), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}
            
            {/* Linked Requirement */}
            {linkedRequirement ? (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Linked Requirement
                </h3>
                <RequirementStatus requirement={linkedRequirement} showLabel={true} />
              </div>
            ) : selectedContent?.requirementPeriod ? (
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Requirement Period
                </h3>
                <p className="text-sm text-gray-300">{selectedContent.requirementPeriod}</p>
              </div>
            ) : null}
          </div>
        }
        metadata={selectedContent ? {
          createdAt: selectedContent.createdAt,
          updatedAt: selectedContent.updatedAt,
        } : undefined}
        onSave={() => {
          if (selectedContent) {
            setIsDrawerOpen(false);
          } else {
            handleCreate({ title: 'Untitled Content' });
          }
        }}
        onDelete={selectedContent ? handleDelete : undefined}
        accent={accent}
      />
    </div>
  );
}

export default function ContentPage() {
  return (
    <ViewProvider moduleName="content" defaultViewType="table">
      <ContentContent />
    </ViewProvider>
  );
}
